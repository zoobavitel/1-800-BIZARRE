# API Usage Guide

This document provides a quick guide on how to interact with the 1-800-BIZARRE backend API.

## 1. Creating an Account

To create a new user account, send a POST request to the `/api/accounts/signup/` endpoint.

**Endpoint:** `/api/accounts/signup/`
**Method:** `POST`
**Content-Type:** `application/json`

**Example Request (using curl):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "my_new_user", "password": "my_secure_password"}' \
  http://127.0.0.1:8000/api/accounts/signup/
```

**Expected Response (on success):**
```json
{
  "token": "your_auth_token_here"
}
```

## 2. Testing Authentication (Logging In)

After creating an account, or if you already have one, you can obtain an authentication token by logging in. This token is required for most API requests.

**Endpoint:** `/api/accounts/login/`
**Method:** `POST`
**Content-Type:** `application/json`

**Example Request (using curl):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "my_new_user", "password": "my_secure_password"}' \
  http://127.0.0.1:8000/api/accounts/login/
```

**Expected Response (on success):**
```json
{
  "token": "your_auth_token_here",
  "expiry": "2026-11-23T20:00:00+00:00",
  "user": {
    "id": 123,
    "username": "my_new_user",
    "email": ""
  }
}
```
**Important:** Save the `token` value. You will use it in the `Authorization` header for subsequent authenticated requests.

Each login issues a new token for that device (django-rest-knox). A token expires 30 days after it was last used; each request pushes the expiry out again. An expired or revoked token gets `401`, as does a request with no credentials.

**Logout:** `POST /api/accounts/logout/` revokes the token the request carries. `POST /api/accounts/logoutall/` revokes every token the user has. Both answer `204`.

**Password change:** `POST /api/user-profiles/change-password/` with `old_password`, `new_password` and `confirm_password`. It revokes every other token the user has; the token that made the request keeps working. A password set any other way (Django admin, `manage.py changepassword`, `set_user_password`) revokes every token.

```bash
curl -X POST \
  -H "Authorization: Token your_auth_token_here" \
  http://127.0.0.1:8000/api/accounts/logout/
```

## 3. Adding a Test Character

Create a character with `POST /api/characters/`. The new character belongs to the signed-in user.

**Endpoint:** `/api/characters/`
**Method:** `POST`
**Content-Type:** `application/json`
**Authorization:** `Token <your_auth_token>`

**Example Request (using curl):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your_auth_token_here" \
  -d '{"true_name": "Jotaro Kujo", "heritage": 1}' \
  http://127.0.0.1:8000/api/characters/
```

**Expected Response (on success):** `201 Created` with the full character, including its `id`.

**Note:** The `id` from the response is what you use to modify the character later.

## 4. Modifying a Test Character

To change fields on a character, send a `PATCH` to the character itself with only the fields you want to change.

**Endpoint:** `/api/characters/{id}/` (replace `{id}` with the character's ID)
**Method:** `PATCH`
**Content-Type:** `application/json`
**Authorization:** `Token <your_auth_token>`

**Example Request (using curl to change `true_name`):**
```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your_auth_token_here" \
  -d '{"true_name": "Jotaro Kujo (Updated)"}' \
  http://127.0.0.1:8000/api/characters/1/
```

The response is the updated character. Fields the server owns are not changed this way: XP clocks and unspent XP always, and stand grades and creation-only fields such as `level` once character creation is done. They are listed in `rejected_fields`. Use the XP and level-up endpoints for those.

**Stale-save check:** every character has a `version` that the server bumps on every write, including writes to its Stand, abilities and progress clocks. Send the `version` you last saw in the PATCH body to make the save conditional. If someone else saved since, the reply is `409` with `{"code": "version_conflict", "current": <the character as it is now>}` and nothing is written. A PATCH without `version` is applied as before. `version` itself can't be set.

The character sheet's autosave sends `version` with only the fields the player edited. On a `409` it compares the reply's `current` with the copy it last saved against. If none of the edited fields changed on the server, it retries quietly with the new version, up to 3 times with backoff. If someone else changed a field the player also edited, the sheet pauses autosave and asks: **Reload** takes the server's value for those fields and keeps the other edits, and **Keep mine** saves the player's value against the new version.

## 5. Testing Endpoints (General)

You can test any GET endpoint by providing your authentication token in the `Authorization` header.

**Example Request (using curl to get all characters):**
```bash
curl -X GET \
  -H "Authorization: Token your_auth_token_here" \
  http://127.0.0.1:8000/api/characters/
```

For more detailed information on available endpoints and their parameters, refer to the API documentation at `/api/docs/`.

**Example Request (using curl to get API documentation):**
```bash
curl -X GET http://127.0.0.1:8000/api/docs/
```
