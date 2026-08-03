import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { serviceRequestsAPI } from '../../services/api';
import { Form, Button, Card, Spinner, Alert } from 'react-bootstrap';

function ClientRequestForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('ANALYSIS');
  const [file, setFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await serviceRequestsAPI.create({
        title,
        description,
        request_type: type
      });

      if (file) {
        await serviceRequestsAPI.uploadDataset(res.id, file);
      }

      navigate('/client-dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="New Service Request" subtitle="Submit data for analysis or investigation">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <Card className="bg-dark border-secondary shadow-sm">
            <Card.Body className="p-4">
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label className="text-light">Request Title</Form.Label>
                  <Form.Control 
                    type="text" 
                    required 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-darker border-secondary text-light"
                    placeholder="e.g. Q3 High-Risk Transactions Analysis"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="text-light">Request Type</Form.Label>
                  <Form.Select 
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="bg-darker border-secondary text-light"
                  >
                    <option value="ANALYSIS">Data Analysis</option>
                    <option value="INVESTIGATION">Deep Investigation</option>
                    <option value="AUDIT">Compliance Audit</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="text-light">Description / Context</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={4}
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-darker border-secondary text-light"
                    placeholder="Provide context for the analysts..."
                  />
                </Form.Group>

                <Form.Group className="mb-5">
                  <Form.Label className="text-light">Dataset Upload (Optional)</Form.Label>
                  <Form.Control 
                    type="file" 
                    onChange={e => setFile(e.target.files[0])}
                    className="bg-darker border-secondary text-light"
                  />
                  <Form.Text className="text-muted">CSV files only. Max 50MB.</Form.Text>
                </Form.Group>

                <div className="d-flex justify-content-end gap-3">
                  <Button variant="outline-secondary" onClick={() => navigate('/client-dashboard')}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={loading || !title}>
                    {loading ? <Spinner size="sm" className="me-2" /> : null}
                    Submit Request
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default ClientRequestForm;
