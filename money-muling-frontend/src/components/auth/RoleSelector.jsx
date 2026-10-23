import React from 'react';
import { motion } from 'framer-motion';
import { ROLES } from './authConstants';

const RoleSelector = ({ selectedRole, onSelectRole }) => {
  return (
    <div className="mb-4">
      <label
        style={{
          color: '#94A3B8',
          letterSpacing: '0.6px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: 8,
          display: 'block',
        }}
      >
        Select Operational Role
      </label>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {ROLES.map((r) => {
          const isSelected = selectedRole === r.value;
          const Icon = r.icon;

          return (
            <motion.button
              key={r.value}
              type="button"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectRole(r.value)}
              style={{
                position: 'relative',
                background: isSelected
                  ? `linear-gradient(180deg, ${r.color}22 0%, ${r.color}0D 100%)`
                  : 'rgba(255, 255, 255, 0.02)',
                border: isSelected
                  ? `1.5px solid ${r.color}90`
                  : '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 14,
                padding: '12px 6px',
                color: isSelected ? '#F8FAFC' : '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: isSelected ? 700 : 500,
                boxShadow: isSelected
                  ? `0 6px 18px ${r.color}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                  : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isSelected ? `${r.color}25` : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? r.color : '#64748B',
                  transition: 'all 0.25s ease',
                }}
              >
                <Icon size={17} />
              </div>

              <span style={{ letterSpacing: '0.2px' }}>{r.label}</span>

              {isSelected && (
                <motion.div
                  layoutId="roleIndicator"
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 14,
                    height: 3,
                    borderRadius: 2,
                    background: r.color,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelector;
