import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = 'USD', rate = 110) {
  if (currency === 'BDT') {
    const bdt = amount * rate;
    return `৳${bdt.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short time for chat list: "10:42 AM", "Yesterday", "Tue", "Mon", or full date */
export function formatTimeShort(date) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDate.getTime() === today.getTime()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (dDate.getTime() === yesterday.getTime()) return 'Yesterday';
  const diffDays = Math.floor((today - dDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Date label for message grouping: "Yesterday, 10:23 AM" or "Today, 9:41 AM" */
export function formatMessageDate(date) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dDate.getTime() === today.getTime()) return `Today, ${time}`;
  if (dDate.getTime() === yesterday.getTime()) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + time;
}

export function getSellerLevelColor(level) {
  const colors = {
    bronze: 'text-orange-400',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    platinum: 'text-cyan-400',
    diamond: 'text-purple-400',
  };
  return colors[level] || 'text-gray-400';
}

export function getSellerLevelBadge(level) {
  const badges = {
    bronze: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    silver: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    platinum: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    diamond: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  };
  return badges[level] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
}

export function getStatusColor(status) {
  const colors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    created: 'bg-blue-500/20 text-blue-400',
    paid: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-green-500/20 text-green-400',
    disputed: 'bg-orange-500/20 text-orange-400',
    refunded: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    sold: 'bg-green-500/20 text-green-400',
    inactive: 'bg-gray-500/20 text-gray-400',
    draft: 'bg-gray-500/20 text-gray-400',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400';
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function formatTimeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now - d) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return formatDate(date);
}

export function getUploadUrl(path) {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  if (!path) return path;
  if (typeof path !== 'string' || path.startsWith('http')) return path;
  const base = (API_URL || '').replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : '/' + path}` : path;
}
