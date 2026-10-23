import React, { useState } from 'react';
import { Form, InputGroup, Button, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import RoleSelector from './RoleSelector';

const inputStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 14,
  padding: '13px 16px',
  color: '#F8FAFC',
  fontSize: 14,
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

const LoginForm = ({
  username,
  setUsername,
  password,
  setPassword,
  selectedRole,
  setSelectedRole,
  rememberMe,
  setRememberMe,
  loading,
  onSubmit,
  currentRoleColor,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form id="loginForm" onSubmit={onSubmit}>
      {/* Role Selector Component */}
      <RoleSelector
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
      />

      {/* Username / Email Field */}
      <Form.Group className="mb-3">
        <Form.Label style={labelStyle}>Username / Email</Form.Label>
        <InputGroup>
          <InputGroup.Text
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRight: 'none',
              borderRadius: '14px 0 0 14px',
              color: '#64748B',
              padding: '0 14px',
            }}
          >
            <User size={16} />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Enter username or email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              ...inputStyle,
              borderRadius: '0 14px 14px 0',
              borderLeft: 'none',
            }}
            required
            autoFocus
          />
        </InputGroup>
      </Form.Group>

      {/* Password Field */}
      <Form.Group className="mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <Form.Label style={labelStyle}>Password</Form.Label>
        </div>

        <InputGroup>
          <InputGroup.Text
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRight: 'none',
              borderRadius: '14px 0 0 14px',
              color: '#64748B',
              padding: '0 14px',
            }}
          >
            <Lock size={16} />
          </InputGroup.Text>
          <Form.Control
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              ...inputStyle,
              borderRadius: '0',
              borderLeft: 'none',
              borderRight: 'none',
            }}
            required
          />
          <Button
            variant="outline-secondary"
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderLeft: 'none',
              color: '#94A3B8',
              borderRadius: '0 14px 14px 0',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
        </InputGroup>

        <div className="d-flex justify-content-between align-items-center mt-2 pt-1">
          <Form.Check
            type="checkbox"
            id="remember-me"
            label="Remember me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{
              color: '#64748B',
              fontSize: 12,
              cursor: 'pointer',
            }}
          />

          <Link
            to="#"
            style={{
              color: '#60A5FA',
              fontSize: 12,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Forgot password?
          </Link>
        </div>
      </Form.Group>

      {/* Submit Button */}
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="mt-4"
      >
        <Button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: `linear-gradient(135deg, ${currentRoleColor}, #7C3AED)`,
            border: 'none',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.3px',
            boxShadow: `0 8px 24px ${currentRoleColor}35`,
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <span className="d-flex align-items-center justify-content-center gap-2">
              Sign In <ArrowRight size={16} />
            </span>
          )}
        </Button>
      </motion.div>
    </Form>
  );
};

export default LoginForm;
