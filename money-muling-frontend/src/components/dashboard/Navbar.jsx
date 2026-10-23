import React from 'react';
import { Navbar as BsNavbar, Container, Button } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, User, LogOut } from 'lucide-react';

const Navbar = ({ onLogout }) => {
  const navigate = useNavigate();

  return (
    <BsNavbar bg="dark" variant="dark" className="px-3 py-2 border-bottom border-secondary">
      <Container fluid className="p-0">
        <BsNavbar.Brand as={Link} to="/dashboard" className="d-flex align-items-center gap-2 text-light fw-bold">
          <Shield size={20} color="#3B82F6" />
          <span>TraceAcc Money Muling Detection Engine</span>
        </BsNavbar.Brand>
        <div className="ms-auto d-flex gap-2">
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => navigate('/profile')}
            className="d-flex align-items-center gap-1"
          >
            <User size={14} /> Profile
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onLogout}
            className="d-flex align-items-center gap-1"
          >
            <LogOut size={14} /> Logout
          </Button>
        </div>
      </Container>
    </BsNavbar>
  );
};

export default Navbar;