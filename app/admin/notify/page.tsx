'use client';
import React, { useState } from 'react';
import { useAccount } from 'wagmi';

interface NotificationResult {
  success?: boolean;
  message?: string;
  error?: string;
  result?: {
    totalSent: number;
    totalFailed: number;
    rateLimitedTokens: string[];
  };
}

export default function AdminNotifyPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [notificationId, setNotificationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NotificationResult | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { address } = useAccount();

  const handleAuthenticate = async () => {
    if (!farcasterUsername.trim() || !address) {
      alert('Please enter your Farcaster username and ensure wallet is connected');
      return;
    }

    // Check if the username matches the admin username
    if (farcasterUsername.trim().toLowerCase() === 'defidevrel') {
      setIsAuthenticated(true);
    } else {
      alert('Access denied. Only defidevrel can access this admin panel.');
      setFarcasterUsername('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !body.trim()) {
      alert('Please fill in both title and body');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetUrl: targetUrl.trim() || undefined,
          notificationId: notificationId.trim() || undefined,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
        // Clear form on success
        setTitle('');
        setBody('');
        setTargetUrl('');
        setNotificationId('');
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: 'Failed to send notification' });
    } finally {
      setIsLoading(false);
    }
  };

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Authentication</h1>
            
            {!address ? (
              <div className="text-center">
                <p className="text-red-600 mb-4">Please connect your wallet first</p>
                <p className="text-sm text-gray-600">You need to connect your Farcaster wallet to access the admin panel.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Connected wallet: <span className="font-mono text-xs">{address}</span>
                </p>
                
                <div className="mb-4">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Farcaster Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={farcasterUsername}
                    onChange={(e) => setFarcasterUsername(e.target.value)}
                    className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                    placeholder="Enter your Farcaster username"
                    required
                  />
                </div>

                <button
                  onClick={handleAuthenticate}
                  className="w-full bg-[#70FF5A] text-white py-2 px-4 rounded-md hover:bg-[#5cef4a] transition-colors"
                >
                  Authenticate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Send Bulk Notification</h1>
            <div className="text-sm text-gray-600">
              Logged in as: <span className="font-semibold text-[#70FF5A]">@{farcasterUsername}</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Notification Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                placeholder="Enter notification title (max 32 chars)"
                maxLength={32}
                required
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
                Notification Body *
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                placeholder="Enter notification message (max 128 chars)"
                maxLength={128}
                required
              />
            </div>

            <div>
              <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Target URL (Optional)
              </label>
              <input
                type="url"
                id="targetUrl"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                placeholder="https://yourdomain.com/specific-page"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to open the main app. Must be on the same domain.
              </p>
            </div>

            <div>
              <label htmlFor="notificationId" className="block text-sm font-medium text-gray-700 mb-2">
                Notification ID (Optional)
              </label>
              <input
                type="text"
                id="notificationId"
                value={notificationId}
                onChange={(e) => setNotificationId(e.target.value)}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                placeholder="daily-update-2024-01-15"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for deduplication. Leave empty for auto-generated ID.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#70FF5A] text-white py-2 px-4 rounded-md hover:bg-[#5cef4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Notification to All Users'}
            </button>
          </form>

          {result && (
            <div className="mt-6 p-4 rounded-md border">
              {result.error ? (
                <div className="text-red-700 bg-red-50 border-red-200">
                  <h3 className="font-medium">Error</h3>
                  <p>{result.error}</p>
                </div>
              ) : (
                <div className="text-green-700 bg-green-50 border-green-200">
                  <h3 className="font-medium">Success!</h3>
                  <p>{result.message}</p>
                  {result.result && (
                    <div className="mt-2 text-sm">
                      <p>Total sent: {result.result.totalSent}</p>
                      <p>Total failed: {result.result.totalFailed}</p>
                      {result.result.rateLimitedTokens.length > 0 && (
                        <p>Rate limited: {result.result.rateLimitedTokens.length}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">How it works</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Notifications are sent to all users who have added your Mini App</li>
              <li>• Users must have notifications enabled in their Farcaster client</li>
              <li>• Rate limits: 1 notification per 30 seconds, 100 per day per user</li>
              <li>• Notifications are batched in groups of 100 for efficiency</li>
              <li>• Users can click notifications to open your app</li>
            </ul>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
