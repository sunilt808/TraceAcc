from models.service_request import ServiceRequest
from models.client_report import ClientReport


def test_admin_request_queue_and_assignment_actions(setup_db, client):
    client_login = client.post('/auth/login', data={'username': 'client1', 'password': 'client123'})
    assert client_login.status_code == 200
    client_headers = {'Authorization': f"Bearer {client_login.json()['access_token']}"}

    create_resp = client.post(
        '/service-requests',
        json={'title': 'New investigation request', 'description': 'Please review this activity'},
        headers=client_headers,
    )
    assert create_resp.status_code == 201
    request_id = create_resp.json()['id']

    admin_login = client.post('/auth/login', data={'username': 'admin', 'password': 'admin123'})
    assert admin_login.status_code == 200
    admin_headers = {'Authorization': f"Bearer {admin_login.json()['access_token']}"}

    queue_resp = client.get('/admin/request-queue', headers=admin_headers)
    assert queue_resp.status_code == 200
    assert queue_resp.json()['counts']['PENDING'] >= 1

    accept_resp = client.patch(
        f'/admin/service-requests/{request_id}/review',
        json={'action': 'ACCEPT', 'note': 'Approved for processing'},
        headers=admin_headers,
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()['status'] == 'APPROVED'

    assign_resp = client.patch(
        f'/admin/service-requests/{request_id}/review',
        json={'action': 'ASSIGN_TRACELAB', 'assignee_id': 2, 'note': 'Send to TraceLab'},
        headers=admin_headers,
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()['status'] == 'IN_PROGRESS'
    assert assign_resp.json()['assigned_user'] == 'analyst'


def test_admin_report_review_and_release_actions(setup_db, client):
    admin_login = client.post('/auth/login', data={'username': 'admin', 'password': 'admin123'})
    assert admin_login.status_code == 200
    admin_headers = {'Authorization': f"Bearer {admin_login.json()['access_token']}"}

    create_resp = client.post(
        '/reports',
        json={'title': 'Draft investigation report', 'summary': 'Initial draft', 'report_type': 'INVESTIGATION'},
        headers=admin_headers,
    )
    assert create_resp.status_code == 201
    report_id = create_resp.json()['id']

    change_resp = client.patch(
        f'/admin/reports/{report_id}/review',
        json={'action': 'REQUEST_CHANGES', 'note': 'Needs more detail'},
        headers=admin_headers,
    )
    assert change_resp.status_code == 200
    assert change_resp.json()['status'] == 'CHANGES_REQUESTED'

    report = setup_db.query(ClientReport).filter(ClientReport.id == report_id).first()
    report.file_path = 'reports/final-report.pdf'
    setup_db.commit()

    release_resp = client.patch(
        f'/admin/reports/{report_id}/review',
        json={'action': 'RELEASE', 'note': 'Approved for client release'},
        headers=admin_headers,
    )
    assert release_resp.status_code == 200
    assert release_resp.json()['status'] == 'RELEASED'
    assert release_resp.json()['is_released'] is True
