
# N8N Webhook Payload Design
**Target System:** SCA Leave Management System  
**Event:** `leave_request.created`

## 1. JSON Schema (Validation)

This schema can be used in an n8n "Edit Fields" node or a custom validation script to ensure data integrity before processing.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["meta", "request", "employee", "system_logic"],
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "event_id": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "environment": { "type": "string", "enum": ["production", "staging", "dev"] },
        "trigger_source": { "type": "string" }
      },
      "required": ["timestamp", "environment"]
    },
    "request": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "reference_code": { "type": "string" },
        "type": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" },
            "unit": { "type": "string", "enum": ["days", "hours", "none"] }
          }
        },
        "timing": {
          "type": "object",
          "properties": {
            "start_date": { "type": "string", "format": "date" },
            "end_date": { "type": "string", "format": "date" },
            "start_time": { "type": ["string", "null"] },
            "end_time": { "type": ["string", "null"] },
            "duration": { "type": "number" }
          }
        },
        "custom_data": { "type": "object" },
        "attachments": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "file_name": { "type": "string" },
              "url": { "type": "string" },
              "mime_type": { "type": "string" }
            }
          }
        }
      },
      "required": ["id", "type", "timing"]
    },
    "employee": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "national_id": { "type": "string" },
        "full_name": { "type": "string" },
        "contact": {
          "type": "object",
          "properties": {
            "email": { "type": "string", "format": "email" },
            "phone": { "type": "string" }
          }
        },
        "organization": {
          "type": "object",
          "properties": {
            "job_title": { "type": "string" },
            "department": { "type": "string" },
            "manager_id": { "type": ["integer", "null"] }
          }
        },
        "balances": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "leave_name": { "type": "string" },
              "remaining": { "type": "number" }
            }
          }
        }
      },
      "required": ["id", "full_name", "contact"]
    },
    "system_logic": {
      "type": "object",
      "properties": {
        "auto_approval_eligible": { "type": "boolean" },
        "risk_score": { "type": "integer", "minimum": 0, "maximum": 100 },
        "failed_rules": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

## 2. Example Request Body

This is the payload that the backend API sends to the n8n Webhook node.

```json
{
  "meta": {
    "event_id": "evt_9872349823",
    "timestamp": "2024-05-20T14:30:00Z",
    "environment": "production",
    "trigger_source": "web_client_v2"
  },
  "request": {
    "id": 1005,
    "reference_code": "REQ-2024-1005",
    "type": {
      "id": 2,
      "name": "Annual Leave",
      "unit": "days"
    },
    "timing": {
      "start_date": "2024-06-01",
      "end_date": "2024-06-05",
      "start_time": null,
      "end_time": null,
      "duration": 5
    },
    "reason": "Family vacation to Alexandria",
    "custom_data": {
      "location_during_leave": "Alexandria, Egypt",
      "emergency_contact": "01222222222"
    },
    "attachments": [
      {
        "file_name": "ticket.pdf",
        "url": "https://api.sca.gov.eg/uploads/req_1005/ticket.pdf",
        "mime_type": "application/pdf"
      }
    ]
  },
  "employee": {
    "id": 101,
    "employee_number": "EMP-101",
    "national_id": "29001010101010",
    "full_name": "Ahmed Mohamed",
    "contact": {
      "email": "ahmed.mohamed@sca.gov.eg",
      "phone": "01000000001"
    },
    "organization": {
      "job_title": "Senior Software Engineer",
      "grade_code": "S1",
      "department": "Information Technology",
      "sector": "Engineering Sector",
      "manager_id": 102
    },
    "balances": [
      {
        "id": 1,
        "leave_name": "Annual Leave",
        "remaining": 16,
        "year": 2024
      },
      {
        "id": 2,
        "leave_name": "Casual Leave",
        "remaining": 4,
        "year": 2024
      }
    ]
  },
  "system_logic": {
    "auto_approval_eligible": false,
    "risk_score": 10,
    "rules_executed": [
      { "rule": "balance_check", "passed": true },
      { "rule": "manager_availability", "passed": true },
      { "rule": "department_capacity", "passed": false, "message": "Dept capacity < 50%" }
    ],
    "ai_recommendation": "MANUAL_REVIEW"
  }
}
```

## 3. Field Explanation & Best Practices

### Meta Object
*   **event_id**: Unique GUID for this webhook event. Useful for de-duplication in n8n.
*   **environment**: Allows n8n to switch logic (e.g., don't send real emails if "dev").
*   **timestamp**: ISO 8601 format. Important for n8n `Date & Time` nodes.

### Request Object
*   **reference_code**: Human-readable ID (e.g., REQ-2024-1005) for use in Email Subjects / Slack notifications.
*   **timing**: Split into date/time/duration components.
    *   *Best Practice*: Backend calculates `duration` to prevent n8n from needing complex date-math nodes.
*   **custom_data**: A flexible JSON object.
    *   *Best Practice*: This handles dynamic fields defined in the `RequestTypes` admin panel without changing the webhook structure.
*   **attachments**: Provides direct URLs.
    *   *Best Practice*: n8n `HTTP Request` nodes can download these files to attach them to outgoing emails.

### Employee Object
*   **contact**: Grouping email/phone makes the JSON cleaner.
    *   *Best Practice*: Include the email here so n8n doesn't have to query the database again to find where to send the "Request Received" email.
*   **organization**: Includes hierarchy info.
    *   *Best Practice*: `manager_id` allows n8n to perform a SQL lookup to find the Approver's email address for the next step.
*   **balances**: Included for context.
    *   *Best Practice*: Allows n8n logic like "If remaining < 2, send warning email".

### System Logic Object
*   **auto_approval_eligible**: Boolean flag computed by the backend.
    *   *Best Practice*: The n8n workflow should start with an `IF` node checking this flag. If `true`, it routes immediately to "Update DB -> Approved". If `false`, it routes to "Send Manager Email".
*   **risk_score**: (0-100). Allows complex n8n routing (e.g., Score > 80 sends SMS to HR Director).
*   **failed_rules**: Array of strings explaining why it wasn't auto-approved. Used in the email body to the Manager.
