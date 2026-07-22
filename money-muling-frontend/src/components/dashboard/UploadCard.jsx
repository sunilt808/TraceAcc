import React, { useRef } from 'react';
import { Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';

const UploadCard = ({ file, onFileChange, onFileParsed, onAnalyze, loading, analysisResult }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      onFileChange(selectedFile);
      
      // Parse CSV file for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          return headers.reduce((obj, header, idx) => {
            obj[header] = values[idx];
            return obj;
          }, {});
        });
        onFileParsed(data);
      };
      reader.readAsText(selectedFile);
    } else {
      alert('Please select a valid CSV file');
      e.target.value = '';
    }
  };

  const handleDownload = () => {
    if (!analysisResult) return;
    const jsonStr = JSON.stringify(analysisResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'analysis-result.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-dark border-secondary">
      <Card.Body>
        <Row className="align-items-center g-2">
          <Col md={5}>
            <Form.Group>
              <Form.Label className="text-light small mb-1">Upload CSV File</Form.Label>
              <div className="d-flex">
                <Form.Control
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="bg-darker text-light border-secondary"
                  disabled={loading}
                />
              </div>
              {file && (
                <div className="text-light small mt-1">
                  Selected: <span className="text-primary">{file.name}</span>
                </div>
              )}
            </Form.Group>
          </Col>

          <Col md={3}>
            <Button
              variant="primary"
              onClick={onAnalyze}
              disabled={!file || loading}
              className="w-100"
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  <span className="ms-2">Analyzing...</span>
                </>
              ) : (
                'Analyze'
              )}
            </Button>
          </Col>

          <Col md={4}>
            <Button
              variant="success"
              onClick={handleDownload}
              disabled={!analysisResult}
              className="w-100"
            >
              Download JSON
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default UploadCard;