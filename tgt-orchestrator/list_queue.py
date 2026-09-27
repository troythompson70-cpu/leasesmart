"""TGT Work Queue list store.

Production reads and writes the SharePoint list. Unit tests keep using the CSV
helpers in queue_engine. lock_token stays in the list and is not copied into
audit output by the callers that already redact it.

Writes prefer Microsoft Graph (Sites.ReadWrite.All). If Graph returns
accessDenied, fall back to SharePoint REST MERGE with a form digest.
Never log tokens or digests.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Mapping, Optional, Tuple

from queue_engine import QUEUE_FIELDS

SITE_ID = "4a25806d-ffa5-4526-a4a1-a1cc1d406a62"
LIST_ID = "926b69f4-7772-4494-92b2-7deaf034c67c"
GRAPH = "https://graph.microsoft.com/v1.0"
LOGIN = "https://login.microsoftonline.com"
DEVICE_CLIENT = "14d82eec-204b-4c2f-b7e8-296a70dab67e"
SP_HOST = "https://netorgft7859571-my.sharepoint.com"
SP_SITE = f"{SP_HOST}/personal/tgates_tgttechnologies_com"
DEVICE_SCOPES = (
    "https://graph.microsoft.com/Files.ReadWrite.All "
    "https://graph.microsoft.com/Sites.ReadWrite.All offline_access"
)
SP_SCOPES = f"{SP_HOST}/AllSites.Write offline_access"


class ListQueueError(RuntimeError):
    pass


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _load_dotenv(path: str, override: bool = False) -> None:
    if not path or not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if not text or text.startswith("#") or "=" not in text:
                continue
            key, raw = text.split("=", 1)
            key = key.strip()
            value = raw.strip().strip("'").strip('"')
            if key and (override or key not in os.environ):
                os.environ[key] = value


def load_graph_env() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    _load_dotenv(os.path.join(repo, ".env"))
    # Device-code client in .env.local replaces the app registration.
    _load_dotenv(os.path.join(repo, "tgt-website", ".env.local"), override=True)


def _token_request(body: dict) -> dict:
    tenant = _env("GRAPH_TENANT_ID")
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request(
        f"{LOGIN}/{urllib.parse.quote(tenant)}/oauth2/v2.0/token",
        data=data,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        code = ""
        try:
            parsed = json.loads(detail)
            code = str(parsed.get("error") or "")
        except json.JSONDecodeError:
            code = "http"
        raise ListQueueError(f"token {exc.code} {code}") from None


def graph_access_token() -> str:
    """Return a delegated or app token. Never log the value."""
    load_graph_env()
    tenant = _env("GRAPH_TENANT_ID")
    client = _env("GRAPH_CLIENT_ID")
    secret = _env("GRAPH_CLIENT_SECRET")
    refresh = _env("GRAPH_REFRESH_TOKEN")
    if not tenant or not client:
        raise ListQueueError("Graph credentials are not configured")
    body = {"client_id": client}
    if refresh:
        body["grant_type"] = "refresh_token"
        body["refresh_token"] = refresh
        if secret and client != DEVICE_CLIENT:
            body["client_secret"] = secret
            body["scope"] = "https://graph.microsoft.com/.default"
        else:
            body["scope"] = DEVICE_SCOPES
    else:
        if not secret:
            raise ListQueueError("Graph credentials are not configured")
        body["grant_type"] = "client_credentials"
        body["client_secret"] = secret
        body["scope"] = "https://graph.microsoft.com/.default"
    payload = _token_request(body)
    token = str(payload.get("access_token") or "")
    if not token:
        raise ListQueueError("token response had no access token")
    return token


def sharepoint_access_token() -> str:
    """Delegated SharePoint token for REST writes. Never log the value."""
    load_graph_env()
    client = _env("GRAPH_CLIENT_ID")
    refresh = _env("GRAPH_REFRESH_TOKEN")
    if not client or not refresh:
        raise ListQueueError("SharePoint credentials are not configured")
    payload = _token_request(
        {
            "client_id": client,
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "scope": SP_SCOPES,
        }
    )
    token = str(payload.get("access_token") or "")
    if not token:
        raise ListQueueError("SharePoint token response had no access token")
    return token


def _graph(method: str, url: str, token: str, payload: Optional[dict] = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:180]
        raise ListQueueError(f"{method} {exc.code} {detail}") from None


def _is_access_denied(exc: ListQueueError) -> bool:
    text = str(exc).lower()
    return "403" in text or "accessdenied" in text or "access is denied" in text


def _sp_digest(token: str) -> str:
    req = urllib.request.Request(f"{SP_SITE}/_api/contextinfo", data=b"", method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json;odata=nometadata")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            ctx = json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:120]
        raise ListQueueError(f"digest {exc.code} {detail}") from None
    digest = str(ctx.get("FormDigestValue") or "")
    if not digest:
        raise ListQueueError("digest missing FormDigestValue")
    return digest


def _sp_rest(
    method: str,
    path: str,
    token: str,
    digest: str,
    payload: Optional[dict] = None,
    http_method: Optional[str] = None,
) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f"{SP_SITE}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json;odata=nometadata")
    req.add_header("X-RequestDigest", digest)
    if payload is not None:
        req.add_header("Content-Type", "application/json;odata=nometadata")
    if http_method:
        req.add_header("IF-MATCH", "*")
        req.add_header("X-HTTP-Method", http_method)
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:180]
        raise ListQueueError(f"REST {http_method or method} {exc.code} {detail}") from None


def _items_url() -> str:
    return f"{GRAPH}/sites/{SITE_ID}/lists/{LIST_ID}/items"


def _row_from_item(item: Mapping) -> Dict[str, str]:
    fields = item.get("fields") or {}
    row = {name: "" for name in QUEUE_FIELDS}
    for name in QUEUE_FIELDS:
        value = fields.get(name)
        row[name] = "" if value is None else str(value)
    if not row["work_order_id"]:
        row["work_order_id"] = str(fields.get("Title") or "")
    row["_item_id"] = str(item.get("id") or "")
    return row


def load_list_queue(token: Optional[str] = None) -> List[Dict[str, str]]:
    token = token or graph_access_token()
    rows: List[Dict[str, str]] = []
    url = _items_url() + "?$expand=fields&$top=200"
    while url:
        page = _graph("GET", url, token)
        for item in page.get("value") or []:
            rows.append(_row_from_item(item))
        url = page.get("@odata.nextLink") or ""
    rows.sort(key=lambda row: row.get("work_order_id") or "")
    return rows


def _fields_body(row: Mapping[str, str]) -> dict:
    fields = {name: str(row.get(name) or "") for name in QUEUE_FIELDS}
    fields["Title"] = fields["work_order_id"]
    return {"fields": fields}


def _write_via_graph(
    item_id: Optional[str], fields: dict, token: str
) -> Tuple[Optional[str], Optional[ListQueueError]]:
    try:
        if item_id:
            _graph("PATCH", f"{_items_url()}/{item_id}/fields", token, fields)
            return item_id, None
        created = _graph("POST", _items_url(), token, {"fields": fields})
        return str(created.get("id") or "") or None, None
    except ListQueueError as exc:
        return None, exc


def _write_via_rest(item_id: Optional[str], fields: dict) -> str:
    token = sharepoint_access_token()
    digest = _sp_digest(token)
    body = dict(fields)
    if item_id:
        _sp_rest(
            "POST",
            f"/_api/web/lists(guid'{LIST_ID}')/items({item_id})",
            token,
            digest,
            body,
            http_method="MERGE",
        )
        return str(item_id)
    created = _sp_rest(
        "POST",
        f"/_api/web/lists(guid'{LIST_ID}')/items",
        token,
        digest,
        body,
    )
    new_id = str(created.get("Id") or created.get("ID") or "")
    if not new_id:
        raise ListQueueError("REST create returned no Id")
    return new_id


def save_list_queue(rows: List[Dict[str, str]], token: Optional[str] = None) -> None:
    """Create or update every row. Does not delete list items that are absent."""
    token = token or graph_access_token()
    existing = {row["work_order_id"]: row.get("_item_id") for row in load_list_queue(token)}
    for row in rows:
        wid = row.get("work_order_id") or ""
        if not wid:
            continue
        body = _fields_body(row)
        item_id = row.get("_item_id") or existing.get(wid)
        new_id, err = _write_via_graph(item_id, body["fields"], token)
        if err is None:
            if new_id:
                row["_item_id"] = new_id
            continue
        if not _is_access_denied(err):
            raise err
        # Graph write denied: SharePoint REST MERGE with form digest.
        row["_item_id"] = _write_via_rest(item_id, body["fields"])
