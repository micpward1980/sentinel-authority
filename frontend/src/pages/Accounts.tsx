// Accounts Page
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import api from '../services/api';
import { Card, Button, Input, Select, Table, StatusBadge, Modal, Spinner, EmptyState } from '../components/ui';
import type { AccountSummary, AccountCreateInput } from '../types';

export function AccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountCreateInput>({
    name: '',
    account_type: 'applicant',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts', search, typeFilter],
    queryFn: () => api.getAccounts({
      search: search || undefined,
      type: typeFilter || undefined,
      per_page: 50,
    }),
  });

  const handleCreate = async () => {
    try {
      await api.createAccount(newAccount);
      setShowCreateModal(false);
      setNewAccount({ name: '', account_type: 'applicant' });
      refetch();
    } catch (error) {
      console.error('Failed to create account:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Accounts</h1>
          <p className="text-gray-400">Manage applicants, certified operators, and licensed implementers</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> New Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1e28] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { value: '', label: 'All Types' },
            { value: 'applicant', label: 'Applicants' },
            { value: 'certified_operator', label: 'Certified Operators' },
            { value: 'licensed_implementer', label: 'Licensed Implementers' },
          ]}
          className="w-48 mb-0"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.items?.length ? (
        <EmptyState
          title="No accounts found"
          description="Create your first account to get started"
          action={<Button onClick={() => setShowCreateModal(true)}>Create Account</Button>}
        />
      ) : (
        <Table
          columns={[
            { 
              key: 'account_number', 
              header: 'Account ID',
              render: (val) => <span className="font-mono text-xs">{val as string}</span>
            },
            { key: 'name', header: 'Organization' },
            { 
              key: 'account_type', 
              header: 'Type',
              render: (val) => (
                <span className="px-2 py-1 bg-indigo-500/10 rounded text-xs">
                  {(val as string).replace('_', ' ')}
                </span>
              )
            },
            { 
              key: 'status', 
              header: 'Status',
              render: (val) => <StatusBadge status={val as string} size="sm" />
            },
            { key: 'created_at', header: 'Created', render: (val) => new Date(val as string).toLocaleDateString() },
          ]}
          data={data.items}
          onRowClick={(row) => navigate(`/accounts/${(row as AccountSummary).id}`)}
        />
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Account">
        <Input
          label="Organization Name"
          value={newAccount.name}
          onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
          placeholder="e.g., Acme Robotics Inc."
        />
        <Select
          label="Account Type"
          value={newAccount.account_type}
          onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value as AccountCreateInput['account_type'] })}
          options={[
            { value: 'applicant', label: 'Applicant' },
            { value: 'certified_operator', label: 'Certified Operator' },
            { value: 'licensed_implementer', label: 'Licensed Implementer' },
          ]}
        />
        <Input
          label="Primary Contact Name"
          value={newAccount.primary_contact_name || ''}
          onChange={(e) => setNewAccount({ ...newAccount, primary_contact_name: e.target.value })}
          placeholder="e.g., Dr. Jane Smith"
        />
        <Input
          label="Email"
          type="email"
          value={newAccount.primary_contact_email || ''}
          onChange={(e) => setNewAccount({ ...newAccount, primary_contact_email: e.target.value })}
          placeholder="contact@example.com"
        />
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Account</Button>
        </div>
      </Modal>
    </div>
  );
}

export default AccountsPage;
