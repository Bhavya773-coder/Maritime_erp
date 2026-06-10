import React from 'react';
import { Calendar, ArrowRight, CornerDownRight } from 'lucide-react';

interface ChainStep {
  from: { id: string; name: string; email: string };
  to: { id: string; name: string; email: string };
  timestamp: string;
  note: string | null;
}

interface DelegationChainProps {
  chain: {
    originalCreator: { name: string; email: string };
    steps: ChainStep[];
    currentHolder: { name: string; email: string };
  };
}

export const DelegationChain: React.FC<DelegationChainProps> = ({ chain }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Accountability Delegation Chain</h3>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        {/* Timeline bar */}
        <div className="absolute top-0 bottom-0 left-9 w-0.5 bg-slate-800/80"></div>
        
        <div className="space-y-6 relative z-10 text-xs">
          {/* Creator entry */}
          <div className="flex items-start space-x-4">
            <div className="h-8 w-8 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold shrink-0 select-none">
              C
            </div>
            <div className="space-y-1">
              <p className="text-slate-200 font-bold text-sm">{chain.originalCreator.name}</p>
              <p className="text-slate-500">Created the task</p>
            </div>
          </div>

          {/* Steps */}
          {chain.steps.map((step, idx) => (
            <div key={idx} className="flex items-start space-x-4">
              <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shrink-0 select-none">
                {idx + 1}
              </div>
              <div className="bg-slate-950/45 border border-slate-800 rounded-lg p-3.5 flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px]">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-medium">Delegated from</span>
                    <span>{step.from.name}</span>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span>{step.to.name}</span>
                  </span>
                  <span className="text-slate-550 flex items-center gap-1 shrink-0 font-medium">
                    <Calendar className="h-3 w-3 text-slate-500" />
                    {new Date(step.timestamp).toLocaleString()}
                  </span>
                </div>
                {step.note && (
                  <p className="text-slate-400 flex items-start gap-1 bg-slate-900/50 p-2 rounded border border-slate-800/40">
                    <CornerDownRight className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="italic">"{step.note}"</span>
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Current Holder */}
          <div className="flex items-start space-x-4">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 animate-pulse select-none">
              H
            </div>
            <div className="space-y-1">
              <p className="text-emerald-400 font-bold text-sm">{chain.currentHolder.name}</p>
              <p className="text-slate-500">Current Task Holder</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
