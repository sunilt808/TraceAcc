import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { casesAPI, evidenceAPI } from '../../services/api';
import { Badge, Button, Tabs, Tab, Table, Spinner, Form, Card } from 'react-bootstrap';
import { FileEarmarkText, CloudArrowUp, CloudDownload, Trash, CheckCircle, Clock } from 'react-bootstrap-icons';

function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [evidence, setEvidence] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadCase = React.useCallback(async () => {
    try {
      setLoading(true);
      const [c, t, e] = await Promise.all([
        casesAPI.get(id),
        casesAPI.getTimeline(id),
        evidenceAPI.list(id)
      ]);
      setCaseData(c);
      setTimeline(t);
      setEvidence(e);
    } catch (err) {
      console.error('Failed to load case', err);
      navigate('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const handleStatusChange = async (newStatus) => {
    try {
      await casesAPI.updateStatus(id, newStatus);
      await loadCase(); // reload to get updated timeline
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setUploading(true);
      await evidenceAPI.upload(id, file);
      const eData = await evidenceAPI.list(id);
      setEvidence(eData);
      const tData = await casesAPI.getTimeline(id);
      setTimeline(tData);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getPriorityColor = (priority) => {
    const colors = { LOW: '#3fb950', MEDIUM: '#d29922', HIGH: '#e3b341', CRITICAL: '#f85149' };
    return colors[priority] || '#8b949e';
  };

  if (loading) {
    return (
      <AppLayout title="Loading Case...">
        <div className="d-flex justify-content-center p-5">
          <Spinner animation="border" variant="primary" />
        </div>
      </AppLayout>
    );
  }

  if (!caseData) return null;

  return (
    <AppLayout title={`Case #${caseData.id}`} subtitle={caseData.title}>
      {/* Case Header Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-dark p-3 rounded border border-secondary shadow-sm">
        <div>
          <h4 className="mb-1 text-light fw-bold">{caseData.title}</h4>
          <div className="text-muted small">
            Created on {new Date(caseData.created_at).toLocaleString()}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div>
            <span className="text-muted small me-2">Priority:</span>
            <span style={{ color: getPriorityColor(caseData.priority), fontWeight: 'bold' }}>
              {caseData.priority}
            </span>
          </div>
          <div>
            <span className="text-muted small me-2">Status:</span>
            <select
              className="form-select form-select-sm bg-darker text-light border-secondary d-inline-block w-auto"
              value={caseData.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={caseData.status === 'CLOSED'}
            >
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="ESCALATED">Escalated</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <Tabs defaultActiveKey="overview" className="mb-4">
        {/* Overview Tab */}
        <Tab eventKey="overview" title="Overview">
          <Card className="bg-darker border-secondary mb-4 shadow-sm">
            <Card.Body>
              <h6 className="text-muted mb-3">Case Description</h6>
              <p className="text-light">{caseData.description || 'No description provided.'}</p>
              <hr className="border-secondary" />
              <h6 className="text-muted mb-3">Analyst Notes</h6>
              <p className="text-light mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {caseData.notes || 'No notes added.'}
              </p>
            </Card.Body>
          </Card>
        </Tab>

        {/* Evidence Tab */}
        <Tab eventKey="evidence" title={`Evidence (${evidence.length})`}>
          <Card className="bg-darker border-secondary shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="text-muted mb-0">Attached Files</h6>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || caseData.status === 'CLOSED'}
                  >
                    {uploading ? <Spinner size="sm" animation="border" className="me-2" /> : <CloudArrowUp className="me-2" />}
                    Upload Evidence
                  </Button>
                </div>
              </div>

              {evidence.length === 0 ? (
                <div className="text-center p-4 border border-secondary border-dashed rounded text-muted">
                  <FileEarmarkText size={32} className="mb-2 opacity-50" />
                  <p className="mb-0">No evidence attached yet.</p>
                </div>
              ) : (
                <Table hover responsive className="align-middle text-light mb-0 border-secondary">
                  <thead>
                    <tr className="text-muted">
                      <th className="border-secondary border-bottom">Filename</th>
                      <th className="border-secondary border-bottom">Type</th>
                      <th className="border-secondary border-bottom">Uploaded</th>
                      <th className="border-secondary border-bottom text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map(item => (
                      <tr key={item.id}>
                        <td className="border-secondary fw-medium">{item.file_name}</td>
                        <td className="border-secondary text-muted small">{item.mime_type || 'Unknown'}</td>
                        <td className="border-secondary text-muted small">{new Date(item.uploaded_at).toLocaleString()}</td>
                        <td className="border-secondary text-end">
                          <Button 
                            variant="link" 
                            className="p-0 text-decoration-none"
                            href={evidenceAPI.downloadUrl(id, item.id)}
                            target="_blank"
                            download
                          >
                            <CloudDownload size={18} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Timeline Tab */}
        <Tab eventKey="timeline" title={`Timeline (${timeline.length})`}>
          <Card className="bg-darker border-secondary shadow-sm">
            <Card.Body>
              <h6 className="text-muted mb-4">Case History</h6>
              <div className="position-relative ps-4 border-start border-secondary" style={{ marginLeft: '12px' }}>
                {timeline.map((event) => (
                  <div key={event.id} className="mb-4 position-relative">
                    <div 
                      className="position-absolute bg-dark border border-primary rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: '32px', height: '32px', left: '-33px', top: '-4px' }}
                    >
                      {event.event_type === 'STATUS_CHANGE' ? (
                        <CheckCircle className="text-primary" size={14} />
                      ) : (
                        <Clock className="text-info" size={14} />
                      )}
                    </div>
                    <div>
                      <div className="d-flex align-items-center mb-1">
                        <Badge bg={event.event_type === 'STATUS_CHANGE' ? 'primary' : 'secondary'} className="me-2">
                          {event.event_type}
                        </Badge>
                        <span className="text-muted small">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-light p-2 bg-dark rounded border border-secondary mt-2">
                        {event.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </AppLayout>
  );
}

export default CaseDetail;
