# API Documentation

This document describes all endpoints exposed by the Money Muling Detection API.

---

## 🔐 Authentication
All endpoints except `/auth/register`, `/auth/login`, and `/sample-generator` require a Bearer token:
`Authorization: Bearer <JWT_TOKEN>`

---

## 🚪 Auth Endpoints

### 1. Register User
*   **Route**: `/auth/register`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "username": "analyst1",
      "password": "securepassword123"
    }
    ```
*   **Response (201 Created)**:
    ```json
    {
      "id": 1,
      "username": "analyst1"
    }
    ```
*   **Error Responses**:
    *   `409 Conflict`: Username already exists.
    *   `422 Unprocessable Entity`: Validation failed.

### 2. Login User
*   **Route**: `/auth/login`
*   **Method**: `POST`
*   **Request Format**: `application/x-www-form-urlencoded`
*   **Request Parameters**:
    *   `username`: "analyst1"
    *   `password`: "securepassword123"
*   **Response (200 OK)**:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
      "token_type": "bearer"
    }
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: Invalid username or password.

### 3. Get Profile Details
*   **Route**: `/auth/me`
*   **Method**: `GET`
*   **Response (200 OK)**:
    ```json
    {
      "id": 1,
      "username": "analyst1"
    }
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: Invalid or expired token.

### 4. Change Password
*   **Route**: `/auth/change-password`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "current_password": "securepassword123",
      "new_password": "newsecurepassword456"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "id": 1,
      "username": "analyst1"
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: Current password is incorrect.
    *   `401 Unauthorized`: Invalid token.

---

## 📊 Analytics Endpoints

### 5. Analyze Transactions
*   **Route**: `/analyze`
*   **Method**: `POST`
*   **Request Format**: `multipart/form-data`
*   **Parameters**:
    *   `file`: CSV file containing columns `transaction_id`, `sender_id`, `receiver_id`, `amount`, and `timestamp`.
*   **Response (200 OK)**:
    ```json
    {
      "summary": {
        "total_accounts_analyzed": 150,
        "total_transactions": 500,
        "suspicious_accounts_flagged": 12,
        "fraud_rings_detected": 3,
        "processing_time_seconds": 0.045
      },
      "suspicious_accounts": [
        {
          "account_id": "ACC002",
          "suspicion_score": 85.0,
          "detected_patterns": ["cycle", "fan"],
          "ring_ids": ["RING_0001", "RING_0002"],
          "burst": false
        }
      ],
      "fraud_rings": [
        {
          "ring_id": "RING_0001",
          "member_accounts": ["ACC002", "ACC005", "ACC009"],
          "pattern_type": "cycle",
          "risk_score": 85.0
        }
      ]
    }
    ```

### 6. Synthetic Transaction Generator
*   **Route**: `/sample-generator`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "numAccounts": 50,
      "numTransactions": 200,
      "minAmount": 10.0,
      "maxAmount": 5000.0,
      "startDate": "2026-01-01",
      "endDate": "2026-01-07",
      "maxPerAccount": 15,
      "datasetType": "mixed",
      "txnPrefix": "TXN",
      "includeCycles": true,
      "includeFan": true,
      "includeLayering": false
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "transactions": [
        {
          "transaction_id": "TXN000001",
          "sender_id": "ACC005",
          "receiver_id": "ACC012",
          "amount": 250.50,
          "timestamp": "2026-01-02 14:30:00"
        }
      ]
    }
    ```

---

## 📜 Audit Log Endpoints

### 7. Fetch Activity Log
*   **Route**: `/audit/activity`
*   **Method**: `GET`
*   **Parameters**:
    *   `limit` (Optional): Default `50`.
    *   `skip` (Optional): Default `0`.
*   **Response (200 OK)**:
    ```json
    [
      {
        "id": 15,
        "timestamp": "2026-07-22T08:15:30Z",
        "event_type": "ANALYZE",
        "event_action": "analyze_success",
        "event_status": "success",
        "user_id": 1,
        "username": "analyst1",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0...",
        "endpoint": "/analyze",
        "method": "POST",
        "details": "{\"filename\": \"data.csv\", \"nodes_analyzed\": 50}",
        "error_message": null,
        "duration_ms": 45
      }
    ]
    ```
