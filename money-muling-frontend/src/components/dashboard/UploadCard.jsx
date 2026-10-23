import React, { useRef, useState } from 'react';
import { Card, Button, Form, Spinner, Badge } from 'react-bootstrap';
import { UploadCloud, FileSpreadsheet, Check, Download, AlertCircle, X, Sparkles } from 'lucide-react';

const UploadCard = ({ file, onFileChange, onFileParsed, onAnalyze, loading, analysisResult }) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = (selectedFile) => {
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      onFileChange(selectedFile);

      // Parse CSV file for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter((line) => line.trim() !== '');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map((h) => h.trim());
          const data = lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim());
            return headers.reduce((obj, header, idx) => {
              obj[header] = values[idx];
              return obj;
            }, {});
          });
          onFileParsed(data);
        }
      };
      reader.readAsText(selectedFile);
    } else {
      alert('Please select a valid .csv file');
    }
  };

  const handleInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownload = () => {
    if (!analysisResult) return;
    const jsonStr = JSON.stringify(analysisResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-result-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      style={{
        backgroundColor: '#05070a',
        borderColor: '#1f242c',
        borderRadius: 8,
      }}
    >
      <Card.Body className="p-3">
        <div className="d-flex flex-column flex-md-row gap-3 align-items-stretch">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: '1 1 auto',
              border: `1.5px dashed ${isDragOver ? '#388bfd' : file ? '#238636' : '#30363d'}`,
              backgroundColor: isDragOver ? 'rgba(56, 139, 253, 0.08)' : '#000000',
              borderRadius: 6,
              padding: '16px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleInputChange}
              style={{ display: 'none' }}
              disabled={loading}
            />

            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 6,
                  backgroundColor: file ? 'rgba(63, 185, 80, 0.12)' : '#161b22',
                  border: `1px solid ${file ? 'rgba(63, 185, 80, 0.3)' : '#30363d'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {file ? (
                  <FileSpreadsheet size={18} color="#3fb950" />
                ) : (
                  <UploadCloud size={18} color="#58a6ff" />
                )}
              </div>

              <div>
                {file ? (
                  <div>
                    <div className="text-white fw-semibold" style={{ fontSize: 13 }}>
                      {file.name}
                    </div>
                    <div className="text-secondary small" style={{ fontSize: 11 }}>
                      {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-white fw-semibold" style={{ fontSize: 13 }}>
                      Drop transaction CSV here, or <span style={{ color: '#58a6ff' }}>browse</span>
                    </div>
                    <div className="text-secondary small" style={{ fontSize: 11 }}>
                      Required columns: sender_id, receiver_id, amount, timestamp
                    </div>
                  </div>
                )}
              </div>
            </div>

            {file && (
              <Button
                variant="link"
                size="sm"
                className="p-1 text-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileChange(null);
                  onFileParsed(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{ textDecoration: 'none' }}
                title="Remove file"
              >
                <X size={16} />
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Button
              onClick={onAnalyze}
              disabled={!file || loading}
              className="d-flex align-items-center justify-content-center gap-2 px-3 py-2 fw-semibold"
              style={{
                backgroundColor: '#238636',
                borderColor: '#2ea043',
                color: '#ffffff',
                fontSize: 13,
                minWidth: 130,
              }}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Run Analysis</span>
                </>
              )}
            </Button>

            {analysisResult && (
              <Button
                onClick={handleDownload}
                variant="outline-secondary"
                className="d-flex align-items-center justify-content-center gap-2 px-3 py-2"
                style={{
                  backgroundColor: '#0d1117',
                  borderColor: '#30363d',
                  color: '#c9d1d9',
                  fontSize: 13,
                }}
              >
                <Download size={14} />
                <span>JSON</span>
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default UploadCard;