import React from 'react';
import { clsx } from 'clsx';
import type { CertificationState, CAT72Status, AccountStatus } from '../types';

// Status Badge Component
interface StatusBadgeProps {
  status: CertificationState | CAT72Status | AccountStatus | string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { color: string; bg: string }> = {
  certified: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  bounded: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  observe: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  suspended: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  revoked: { color: '#7f1d1d', bg: 'rgba(127, 29, 29, 0.15)' },
  active: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  inactive: { color: '#5c6578', bg: 'rgba(92, 101, 120, 0.15)' },
  pending: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  terminated: { color: '#7f1d1d', bg: 'rgba(127, 29, 29, 0.15)' },
  in_progress: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  passed: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  scheduled: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  aborted: { color: '#5c6578', bg: 'rgba(92, 101, 120, 0.15)' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.inactive;
  
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-mono uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      )}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderRadius: '4px',
        fontWeight: 600,
      }}
    >
      <span
        className={clsx(
          'rounded-full',
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          status === 'in_progress' && 'animate-pulse'
        )}
        style={{ backgroundColor: config.color }}
      />
      {status.replace('_', ' ')}
    </span>
  );
}

// Card Component
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-[#12151c] border border-white/[0.08] rounded-xl p-5',
        'transition-all duration-200',
        hoverable && 'hover:border-white/[0.15] hover:-translate-y-0.5 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-indigo-500 text-white hover:bg-indigo-600',
    secondary: 'bg-transparent text-white border border-white/[0.08] hover:bg-white/5',
    ghost: 'bg-transparent text-gray-400 hover:bg-white/5 hover:text-white',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-lg',
        'transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block mb-1.5 text-sm font-medium text-gray-400">
          {label}
        </label>
      )}
      <input
        className={clsx(
          'w-full px-4 py-2.5 text-sm bg-[#1a1e28] border border-white/[0.08] rounded-lg',
          'text-white placeholder-gray-500',
          'focus:outline-none focus:border-indigo-500',
          'transition-colors duration-200',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block mb-1.5 text-sm font-medium text-gray-400">
          {label}
        </label>
      )}
      <select
        className={clsx(
          'w-full px-4 py-2.5 text-sm bg-[#1a1e28] border border-white/[0.08] rounded-lg',
          'text-white cursor-pointer',
          'focus:outline-none focus:border-indigo-500',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, trend, icon }: MetricCardProps) {
  return (
    <Card className="flex-1 min-w-[200px]">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            {label}
          </div>
          <div className="text-3xl font-bold font-mono">{value}</div>
          {trend !== undefined && (
            <div
              className={clsx(
                'text-xs mt-1',
                trend > 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
            </div>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center text-2xl">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// Progress Ring Component
interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#10b981',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1a1e28"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#12151c] border border-white/[0.08] rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-white/[0.08]">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Table Component
interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto border border-white/[0.08] rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1a1e28]">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-white/[0.08]"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={clsx(
                'border-b border-white/[0.08] transition-colors',
                rowIndex % 2 === 0 ? 'bg-[#12151c]' : 'bg-[#1a1e28]',
                onRowClick && 'hover:bg-[#222733] cursor-pointer'
              )}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  {col.render
                    ? col.render(row[col.key as keyof T], row)
                    : String(row[col.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Loading Spinner
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-t-indigo-500 border-r-transparent border-b-indigo-500 border-l-transparent',
        sizes[size]
      )}
    />
  );
}

// Empty State
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}
