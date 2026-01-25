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
