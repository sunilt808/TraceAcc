import React, { useState } from 'react';
import { Form, Row, Col, Button, Spinner, InputGroup } from 'react-bootstrap';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Building,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

const inputStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 14,
  padding: '12px 16px',
  color: '#F8FAFC',
  fontSize: 13,
  transition: 'all 0.25s ease',
};

const labelStyle = {
  color: '#94A3B8',
  letterSpacing: '0.6px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

const sectionTitleStyle = {
  color: '#34D399',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const RegisterForm = ({
  registerData,
  handleRegisterChange,
  loading,
  onSubmit,
}) => {
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  return (
    <Form onSubmit={onSubmit}>
    

      {/* 1. Organization Details */}
      <div style={sectionTitleStyle}>
        <Building size={14} /> Organization Details
      </div>

      <Row>
        <Col md={7}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Organization Name *</Form.Label>
            <Form.Control
              type="text"
              name="org_name"
              placeholder="e.g. Acme Financial Group"
              style={inputStyle}
              required
              value={registerData.org_name}
              onChange={handleRegisterChange}
            />
          </Form.Group>
        </Col>

        <Col md={5}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Institution Type *</Form.Label>
            <Form.Select
              name="org_type"
              style={inputStyle}
              required
              value={registerData.org_type}
              onChange={handleRegisterChange}
            >
              <option value="Bank" style={{ background: '#0F172A', color: '#FFF' }}>
                Bank
              </option>
              <option value="FinTech" style={{ background: '#0F172A', color: '#FFF' }}>
                FinTech
              </option>
              <option value="Company" style={{ background: '#0F172A', color: '#FFF' }}>
                Company
              </option>
              <option value="General Business" style={{ background: '#0F172A', color: '#FFF' }}>
                General Business
              </option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Form.Group className="mb-3">
        <Form.Label style={labelStyle}>Registration / License Number</Form.Label>
        <Form.Control
          type="text"
          name="registration_number"
          placeholder="e.g. U65990KA2021PTC123456"
          style={inputStyle}
          value={registerData.registration_number}
          onChange={handleRegisterChange}
        />
      </Form.Group>

      {/* 2. Primary Contact */}
      <div style={{ ...sectionTitleStyle, marginTop: 16 }}>
        <User size={14} /> Primary Contact
      </div>

      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Contact Person *</Form.Label>
            <Form.Control
              type="text"
              name="contact_person"
              placeholder="Full Name"
              style={inputStyle}
              required
              value={registerData.contact_person}
              onChange={handleRegisterChange}
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Phone Number *</Form.Label>
            <Form.Control
              type="tel"
              name="phone"
              placeholder="+1 (555) 000-0000"
              style={inputStyle}
              required
              value={registerData.phone}
              onChange={handleRegisterChange}
            />
          </Form.Group>
        </Col>
      </Row>

      <Form.Group className="mb-3">
        <Form.Label style={labelStyle}>Organization Email *</Form.Label>
        <Form.Control
          type="email"
          name="org_email"
          placeholder="compliance@organization.com"
          style={inputStyle}
          required
          value={registerData.org_email}
          onChange={handleRegisterChange}
        />
        <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
          This address will be your username for signing in.
        </div>
      </Form.Group>

      {/* 3. Account Security */}
      <div style={{ ...sectionTitleStyle, marginTop: 16 }}>
        <Lock size={14} /> Account Security
      </div>

      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label style={labelStyle}>Password *</Form.Label>
            <InputGroup>
              <Form.Control
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder="Min. 8 characters"
                style={{
                  ...inputStyle,
                  borderRadius: '14px 0 0 14px',
                }}
                required
                minLength={8}
                value={registerData.password}
                onChange={handleRegisterChange}
              />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderLeft: 'none',
                  color: '#94A3B8',
                  borderRadius: '0 14px 14px 0',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </InputGroup>
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group className="mb-4">
            <Form.Label style={labelStyle}>Confirm Password *</Form.Label>
            <InputGroup>
              <Form.Control
                type={showConfirmPass ? 'text' : 'password'}
                name="confirm_password"
                placeholder="Re-enter password"
                style={{
                  ...inputStyle,
                  borderRadius: '14px 0 0 14px',
                }}
                required
                minLength={8}
                value={registerData.confirm_password}
                onChange={handleRegisterChange}
              />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderLeft: 'none',
                  color: '#94A3B8',
                  borderRadius: '0 14px 14px 0',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </InputGroup>
          </Form.Group>
        </Col>
      </Row>

      {/* Submit Button */}
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="mt-2"
      >
        <Button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 15,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <span className="d-flex align-items-center justify-content-center gap-2" style={{ textAlign: 'center' }}>
              Create Client Account <ArrowRight size={16} />
            </span>
          )}
        </Button>
      </motion.div>
    </Form>
  );
};

export default RegisterForm;
