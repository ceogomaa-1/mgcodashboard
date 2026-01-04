'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Mail, Phone, MapPin, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const industries = [
  'Healthcare',
  'Legal Services',
  'Real Estate',
  'Financial Services',
  'Automotive',
  'Home Services',
  'Retail',
  'Hospitality',
  'Technology',
  'Other',
];

export default function AddClient() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    business_name: '',
    owner_email: '',
    industry: '',
    phone_number: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          business_name: formData.business_name,
          owner_email: formData.owner_email,
          industry: formData.industry,
          phone_number: formData.phone_number,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          status: 'ONBOARDING',
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Create integrations record
      await supabase
        .from('integrations')
        .insert({
          client_id: client.id,
          retell_connected: false,
          google_calendar_connected: false,
        });

      // Send magic link to client
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: formData.owner_email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?role=CLIENT&client_id=${client.id}`,
        },
      });

      if (authError) throw authError;

      alert(`Client created! Magic link sent to ${formData.owner_email}`);
      router.push('/techops/dashboard');
    } catch (err: any) {
      console.error('Error creating client:', err);
      setError(err.message || 'Failed to create client');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <Link 
            href="/techops/dashboard"
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Add New Client</h1>
          <p className="text-slate-400">Create a new client account and send them access credentials</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-red-500 font-medium">Error</p>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="business_name" className="text-white">
                  Business Name *
                </Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => handleChange('business_name', e.target.value)}
                  placeholder="Acme Corp"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-white">
                  Industry *
                </Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => handleChange('industry', value)}
                  required
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {industries.map((industry) => (
                      <SelectItem 
                        key={industry} 
                        value={industry}
                        className="text-white hover:bg-slate-600"
                      >
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Owner Email */}
              <div className="space-y-2">
                <Label htmlFor="owner_email" className="text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Owner Email *
                </Label>
                <Input
                  id="owner_email"
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => handleChange('owner_email', e.target.value)}
                  placeholder="owner@business.com"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
                <p className="text-xs text-slate-500">
                  A magic link will be sent to this email for account access
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-white flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number *
                </Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => handleChange('phone_number', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Street Address
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="123 Main Street"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {/* City, State, ZIP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-white">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="New York"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-white">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="NY"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code" className="text-white">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleChange('zip_code', e.target.value)}
                    placeholder="10001"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Link href="/techops/dashboard" className="flex-1">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Creating Client...' : 'Create Client'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}