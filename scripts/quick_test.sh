#!/bin/bash

# quick_test.sh - Example curl commands to test backend endpoints
# Usage: bash scripts/quick_test.sh (after backend is running on localhost:4000)

BASE_URL="http://localhost:4000/api"

echo "=== Testing Health ===" 
curl -X GET http://localhost:4000/health

echo -e "\n\n=== Testing Auth Login ===" 
curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"any"}'

echo -e "\n\n=== Getting Admin Lists ===" 
curl -X GET $BASE_URL/admin/lists

echo -e "\n\n=== Getting Admin List Items (transfer_reasons) ===" 
curl -X GET "$BASE_URL/admin/lists/transfer_reasons/items"

echo -e "\n\n=== Creating Sample Admin List ===" 
curl -X POST $BASE_URL/admin/lists \
  -H "Content-Type: application/json" \
  -d '{"listName":"qualifications","description":"Employee Qualifications"}'

echo -e "\n\n=== Adding Item to List ===" 
curl -X POST "$BASE_URL/admin/lists/qualifications/items" \
  -H "Content-Type: application/json" \
  -d '{"label":"Bachelor Degree","value":"bachelors"}'

echo -e "\n\n=== Getting Users ===" 
curl -X GET $BASE_URL/admin/users

echo -e "\n\n=== Getting Org Units ===" 
curl -X GET $BASE_URL/admin/org-units

echo -e "\n\n=== Getting Job Titles ===" 
curl -X GET $BASE_URL/admin/job-titles

echo -e "\n\n=== Getting Employee Balances ===" 
curl -X GET $BASE_URL/employee/balances

echo -e "\n\nDone! Adjust URLs as needed for your backend instance."
