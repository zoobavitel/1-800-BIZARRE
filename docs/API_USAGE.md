# API Usage Guide

This document provides a quick guide on how to interact with the JoJo TTRPG backend API.

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
  "user": {
    "id": 123,
    "username": "my_new_user"
  }
}
```
**Important:** Save the `token` value. You will use it in the `Authorization` header for subsequent authenticated requests.

## 3. Adding a Test Character

You can create a new character template with default values using the `/api/characters/create-template/` endpoint.

**Endpoint:** `/api/characters/create-template/`
**Method:** `POST`
**Content-Type:** `application/json`
**Authorization:** `Token <your_auth_token>`

**Example Request (using curl):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your_auth_token_here" \
  -d '{"character_data": {"true_name": "Jotaro Kujo", "playbook": "STAND"}}' \
  http://127.0.0.1:8000/api/characters/create-template/
```

**Expected Response (on success):**
```json
{
  "success": true,
  "character_id": 1,
  "character": {
    // ... full character object details ...
  },
  "message": "Character template created successfully"
}
```
**Note:** The `character_id` from the response is important for modifying the character later.

## 4. Modifying a Test Character

To modify a specific field of a character, use the `/api/characters/{id}/update-field/` endpoint with a `PATCH` request.

**Endpoint:** `/api/characters/{id}/update-field/` (replace `{id}` with the character's ID)
**Method:** `PATCH`
**Content-Type:** `application/json`
**Authorization:** `Token <your_auth_token>`

**Example Request (using curl to change `true_name`):**
```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your_auth_token_here" \
  -d '{"field": "true_name", "value": "Jotaro Kujo (Updated)"}' \
  http://127.0.0.1:8000/api/characters/1/update-field/
```

**Example Request (using curl to update `coin_stats`):**
```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your_auth_token_here" \
  -d '{"field": "coin_stats", "value": {"power": "A", "speed": "C", "range": "C", "durability": "D", "precision": "D", "development": "F"}}' \
  http://127.0.0.1:8000/api/characters/1/update-field/
```

**Expected Response (on success):**
```json
{
  "success": true,
  "field": "true_name",
  "value": "Jotaro Kujo (Updated)",
  "message": "true_name updated successfully"
}
```

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
