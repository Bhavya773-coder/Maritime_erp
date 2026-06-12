import React from 'react';
import { Link } from 'react-router-dom';
import type { Vessel } from '../../api/vessels';
import { VesselStatusBadge } from './VesselStatusBadge';
import { MapPin, Compass, Calendar, User, Anchor, ArrowRight } from 'lucide-react';

interface VesselCardProps {
  vessel: Vessel;
  canUpdateLocation: boolean;
  onUpdateLocationClick: (vessel: Vessel) => void;
}

export const VesselCard: React.FC<VesselCardProps> = ({ 
  vessel, 
  canUpdateLocation, 
  onUpdateLocationClick 
}) => {
  return (
    <Link 
      to={`/fleet/${vessel.id}`}
      className="glassmorphism p-6 rounded-2xl border border-slate-800 hover:border-slate-700 hover:shadow-xl transition-all group flex flex-col justify-between h-full cursor-pointer relative overflow-hidden"
    >
      {/* Decorative top gradient glow */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-500/0 via-brand-500/30 to-brand-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-brand-400 group-hover:text-brand-300 transition-all">
              <Anchor className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors leading-tight truncate max-w-[150px]">
                {vessel.name}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold tracking-wider uppercase">
                {vessel.type}
              </p>
            </div>
          </div>
          <VesselStatusBadge status={vessel.status} />
        </div>

        <div className="space-y-3 mt-4 text-xs">
          {/* Registration Number */}
          <div className="flex items-center justify-between text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/40">
            <span className="text-[10px] text-slate-550 uppercase font-semibold tracking-wider">Reg No</span>
            <span className="font-semibold text-slate-200">{vessel.registrationNo}</span>
          </div>

          {/* Current Location */}
          <div className="flex items-start space-x-2 text-slate-300 mt-2">
            <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-slate-550 uppercase font-semibold tracking-wider">Current Location</p>
              <p className="font-medium text-slate-200 line-clamp-1">{vessel.currentLocation}</p>
            </div>
          </div>

          {/* Coordinates */}
          <div className="flex items-start space-x-2 text-slate-300">
            <Compass className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-slate-550 uppercase font-semibold tracking-wider">Coordinates</p>
              <p className="font-medium text-slate-300 font-mono text-[11px]">
                {vessel.latitude.toFixed(4)}° N, {vessel.longitude.toFixed(4)}° E
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex flex-col text-[10px] text-slate-500 truncate max-w-[120px]">
          <div className="flex items-center space-x-1">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">By {vessel.updatedBy?.name || 'System'}</span>
          </div>
          <div className="flex items-center space-x-1 mt-0.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{new Date(vessel.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {canUpdateLocation && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUpdateLocationClick(vessel);
              }}
              className="px-3 py-1.5 bg-brand-600/10 hover:bg-brand-600 text-brand-400 hover:text-white border border-brand-500/20 hover:border-brand-500 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none"
            >
              Update Loc
            </button>
          )}
          <span className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-white group-hover:border-slate-600 rounded-lg transition-all">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};
