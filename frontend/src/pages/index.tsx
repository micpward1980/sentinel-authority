// Placeholder pages - to be fully implemented

import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button } from '../components/ui';

export function AccountDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Account Details</h1>
      <Card>
        <p className="text-gray-400">Account ID: {id}</p>
        <p className="text-gray-500 mt-4">Full account detail view - connect to API</p>
      </Card>
    </div>
  );
}

export function SystemsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Systems</h1>
          <p className="text-gray-400">Registered autonomous systems</p>
        </div>
        <Button>+ Register System</Button>
      </div>
      <Card>
        <p className="text-gray-500">Systems list - connect to API</p>
      </Card>
    </div>
  );
}

export function SystemDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Details</h1>
      <Card>
        <p className="text-gray-400">System ID: {id}</p>
      </Card>
    </div>
  );
}

export function CAT72Page() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">CAT-72 Tests</h1>
          <p className="text-gray-400">Convergence Authorization Test - 72-hour validation</p>
        </div>
        <Button>+ Schedule Test</Button>
      </div>
      <Card>
        <p className="text-gray-500">CAT-72 tests list - connect to API</p>
      </Card>
    </div>
  );
}

export function CAT72DetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">CAT-72 Test Details</h1>
      <Card>
        <p className="text-gray-400">Test ID: {id}</p>
      </Card>
    </div>
  );
}

export function ConformanceRecordsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Conformance Records</h1>
          <p className="text-gray-400">ODDC attestations with cryptographic verification</p>
        </div>
        <Button variant="secondary">🔍 Verify Record</Button>
      </div>
      <Card>
        <p className="text-gray-500">Conformance records list - connect to API</p>
      </Card>
    </div>
  );
}

export function VerifyPage() {
  const { recordNumber } = useParams();
  return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-4">Verify Conformance Record</h1>
        <p className="text-gray-400 mb-6">
          Enter a record ID or hash to verify its authenticity
        </p>
        {recordNumber && <p className="text-indigo-400">Verifying: {recordNumber}</p>}
        <input
          type="text"
          placeholder="ODDC-2026-XXXXX or record hash"
          className="w-full px-4 py-3 bg-[#1a1e28] border border-white/[0.08] rounded-lg mb-4"
        />
        <Button className="w-full">Verify</Button>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Organization</h2>
          <p className="text-gray-500">Organization settings - connect to API</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-4">API Configuration</h2>
          <div className="p-4 bg-[#1a1e28] rounded-lg font-mono text-sm">
            <div className="text-gray-500 mb-1">API Endpoint</div>
            <div>https://api.sentinelauthority.org/v1</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
