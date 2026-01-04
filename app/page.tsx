import Link from 'next/link';
import { Briefcase, Store } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            MG&CO Dashboard
          </h1>
          <p className="text-slate-400 text-lg">
            Choose your portal to continue
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Link href="/techops/login">
            <div className="cursor-pointer hover:scale-105 transition-all duration-300 border-2 border-slate-700 hover:border-blue-500 bg-slate-800/50 backdrop-blur rounded-lg p-8">
              <div className="text-center pb-8 pt-4">
                <div className="mx-auto mb-6 w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Briefcase className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-3xl text-white mb-3 font-bold">
                  TechOps Portal
                </h2>
                <p className="text-slate-400 text-base mb-6">
                  For MG&CO technical team members
                </p>
                <ul className="text-slate-300 space-y-2 text-sm">
                  <li>✓ Manage client accounts</li>
                  <li>✓ Configure integrations</li>
                  <li>✓ Handle support tickets</li>
                </ul>
              </div>
            </div>
          </Link>

          <Link href="/client/login">
            <div className="cursor-pointer hover:scale-105 transition-all duration-300 border-2 border-slate-700 hover:border-green-500 bg-slate-800/50 backdrop-blur rounded-lg p-8">
              <div className="text-center pb-8 pt-4">
                <div className="mx-auto mb-6 w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Store className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl text-white mb-3 font-bold">
                  Client Dashboard
                </h2>
                <p className="text-slate-400 text-base mb-6">
                  For business owners
                </p>
                <ul className="text-slate-300 space-y-2 text-sm">
                  <li>✓ View call analytics</li>
                  <li>✓ Manage bookings</li>
                  <li>✓ Track billing & ROI</li>
                </ul>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}