import React from 'react';
import { Navbar as BsNavbar, Container, Button } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';

const Navbar = ({ onLogout }) => {
  const navigate = useNavigate();

  return (
    <BsNavbar bg="dark" variant="dark" className="px-3 py-2 border-bottom border-secondary">
      <Container fluid className="p-0">
        <BsNavbar.Brand as={Link} to="/dashboard" className="d-flex align-items-center gap-2 text-light fw-bold">
          <span style={{ color: '#2F73FF', fontSize: '22px' }}>⬡</span>
          TraceAcc Money Muling Detection Engine
        </BsNavbar.Brand>
        <div className="ms-auto d-flex gap-2">
          <Button variant="outline-light" size="sm" onClick={() => navigate('/profile')}>
            Profile
          </Button>
          <Button variant="outline-light" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </Container>
    </BsNavbar>
  );
};

export default Navbar;