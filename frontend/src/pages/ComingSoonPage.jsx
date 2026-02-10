import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, ArrowLeft, Gamepad2 } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function ComingSoonPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-pulse bg-[#13ec5b]/20 blur-xl rounded-full"></div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-zinc-900 border border-[#13ec5b]/30 shadow-[0_0_30px_rgba(19,236,91,0.3)]">
          <Construction className="h-12 w-12 text-[#13ec5b]" />
        </div>
      </div>

      <h1 className="mb-4 text-4xl font-bold tracking-tight text-white md:text-6xl text-center">
        Coming <span className="text-[#13ec5b]">Soon</span>
      </h1>
      
      <p className="mb-8 max-w-lg text-center text-lg text-zinc-400">
        We're crafting this level! This feature is currently under development and will be unlocked in a future update.
      </p>

      <div className="flex gap-4">
        <Button 
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 bg-white/5 text-white hover:bg-white/10 border border-white/10"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Go Back
        </Button>
        <Button 
          onClick={() => navigate('/')}
          className="bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90 font-bold shadow-[0_0_20px_rgba(19,236,91,0.4)] hover:shadow-[0_0_30px_rgba(19,236,91,0.6)]"
        >
          <Gamepad2 className="mr-2 h-4 w-4" />
          Home Base
        </Button>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-8 text-center md:grid-cols-4 opacity-50">
        {[
          { label: 'Completion', value: '85%' },
          { label: 'Bugs Squashed', value: '142' },
          { label: 'Coffee Consumed', value: '∞' },
          { label: 'Excitement', value: '1000%' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-white">{stat.value}</span>
            <span className="text-xs uppercase tracking-wider text-zinc-500">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
