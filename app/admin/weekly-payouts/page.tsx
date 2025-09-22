/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect } from 'react';

export default function WeeklyPayoutsPage() {
  const [loading, setLoading] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [currentWeek, setCurrentWeek] = useState('');

  useEffect(() => {
    // Get current week start
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeek(monday.toISOString().slice(0, 10));
    
    // Load current week payouts
    loadPayouts(monday.toISOString().slice(0, 10));
  }, []);

  const loadPayouts = async (weekStart: string) => {
    try {
      const response = await fetch(`/api/weekly-payout?week=${weekStart}`);
      const data = await response.json();
      setPayouts(data.payouts || []);
    } catch (error) {
      console.error('Failed to load payouts:', error);
    }
  };

  const triggerPayouts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/weekly-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeek })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Weekly payouts sent successfully!');
        loadPayouts(currentWeek);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to trigger payouts');
      console.error('Payout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const forcePayouts = async () => {
    if (!confirm('Force payouts even if already sent? This will resend payments.')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/weekly-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeek, force: true })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Weekly payouts sent successfully!');
        loadPayouts(currentWeek);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to trigger payouts');
      console.error('Payout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-10 pb-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black text-center mb-8 text-black tracking-wider">
          Weekly Payouts
        </h1>
        
        <div className="bg-white rounded-2xl border border-[#F3F4F6] p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Current Week: {currentWeek}</h2>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={triggerPayouts}
              disabled={loading}
              className="px-6 py-3 bg-[#70FF5A] text-black font-bold rounded-xl hover:bg-[#5FE04A] disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Weekly Payouts'}
            </button>
            
            <button
              onClick={forcePayouts}
              disabled={loading}
              className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Force Payouts'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#F3F4F6] p-6">
          <h2 className="text-xl font-bold mb-4">Payout History</h2>
          
          {payouts.length === 0 ? (
            <p className="text-[#9CA3AF] text-center py-8">No payouts sent for this week</p>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div key={payout.rank} className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 flex items-center justify-center text-xl">
                      {payout.rank === 1 ? '🥇' : payout.rank === 2 ? '🥈' : '🥉'}
                    </div>
                    <div>
                      <div className="font-medium text-lg text-black">
                        {payout.alias ? `@${payout.alias}` : `${payout.address.slice(0,6)}…${payout.address.slice(-4)}`}
                      </div>
                      <div className="text-sm text-[#9CA3AF]">
                        {payout.amount_eth} ETH
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#9CA3AF]">
                      {payout.paid_at ? new Date(payout.paid_at).toLocaleString() : 'Pending'}
                    </div>
                    {payout.tx_hash && (
                      <a 
                        href={`https://basescan.org/tx/${payout.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        View TX
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

