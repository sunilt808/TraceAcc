from models.alert import Alert
from models.workflow_instance import WorkflowInstance
from models.client_report import ClientReport


def test_service_request_creates_workflow_and_supports_transition(setup_db, client):
    client_login = client.post("/auth/login", data={"username": "client1", "password": "client123"})
    assert client_login.status_code == 200
    client_headers = {"Authorization": f"Bearer {client_login.json()['access_token']}"}

    create_resp = client.post(
        "/service-requests",
        json={"title": "Urgent review", "description": "Please review this case"},
        headers=client_headers,
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    assert payload["workflow_instance_id"] is not None

    workflow_id = payload["workflow_instance_id"]

    admin_login = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    transition_resp = client.patch(
        f"/workflow-instances/{workflow_id}/transition",
        json={"status": "UNDER_REVIEW", "stage": "ADMIN_REVIEW", "note": "Approved for triage"},
        headers=admin_headers,
    )
    assert transition_resp.status_code == 200
    assert transition_resp.json()["current_status"] == "UNDER_REVIEW"

    assign_resp = client.post(
        f"/workflow-instances/{workflow_id}/assign",
        json={"assignee_id": 2},
        headers=admin_headers,
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assignee_id"] == 2

    timeline_resp = client.get(f"/workflow-instances/{workflow_id}/timeline", headers=admin_headers)
    assert timeline_resp.status_code == 200
    assert len(timeline_resp.json()["items"]) >= 2


def test_alert_escalation_links_existing_workflow_and_updates_status(setup_db, client):
    workflow = WorkflowInstance(organization_id=1, service_request_id=1, current_status="ANALYSIS_IN_PROGRESS", current_stage="TRACE_LAB")
    setup_db.add(workflow)
    setup_db.flush()

    alert = Alert(
        organization_id=1,
        alert_type="HIGH_RISK_ACCOUNT",
        risk_score=90.0,
        severity="HIGH",
        status="NEW",
        workflow_instance_id=workflow.id,
    )
    setup_db.add(alert)
    setup_db.commit()

    admin_login = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    response = client.post(f"/alerts/{alert.id}/escalate", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["case_id"] is not None

    case_id = payload["case_id"]
    case_resp = client.get(f"/cases/{case_id}", headers=admin_headers)
    assert case_resp.status_code == 200
    assert case_resp.json()["workflow_instance_id"] == workflow.id

    workflow_resp = client.get(f"/workflow-instances/{workflow.id}/timeline", headers=admin_headers)
    assert workflow_resp.status_code == 200
    assert len(workflow_resp.json()["items"]) >= 2


def test_report_submission_and_approval_workflow(setup_db, client):
    admin_login = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    create_resp = client.post(
        "/reports",
        json={"title": "Investigation Summary", "summary": "Draft", "report_type": "INVESTIGATION"},
        headers=admin_headers,
    )
    assert create_resp.status_code == 201
    report_id = create_resp.json()["id"]

    submit_resp = client.post(f"/reports/{report_id}/submit-for-review", headers=admin_headers)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "READY_FOR_REVIEW"

    approve_resp = client.post(f"/reports/{report_id}/approve", headers=admin_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "RELEASED"
    assert approve_resp.json()["is_released"] is True
