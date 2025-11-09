
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Users, Hospital, CheckCircle, Package, Users as UsersIcon, TrendingUp, AlertTriangle, ArrowRightLeft, Thermometer, FileText, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUsers, getCenters, updateUserRole, verifyCenter, rejectCenter } from './actions';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  getCenterManagementData, 
  getWastageData, 
  recordVaccineMovement 
} from './actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = 'force-dynamic';

type UserData = {
  _id: string;
  firebaseUid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'citizen' | 'authority' | 'center';
};

type CenterData = {
    _id: string;
    center_name: string;
    email: string;
    location: {
        district: string;
        address: string;
    };
    verified: boolean;
};

type CenterManagementData = {
  centers: CenterData[];
  vaccines: any[];
  staff: any[];
  movements: any[];
};

type WastageData = {
  totalWasted: number;
  totalUsed: number;
  totalRemaining: number;
  totalStock: number;
  wastageRate: string;
  highRiskCenters: any[];
  centerWastage: any[];
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user: firebaseUser, isLoading: isAuthLoading } = useUser();
  const [localUser, setLocalUser] = React.useState<any>(null);
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [centers, setCenters] = React.useState<CenterData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();
  const [centerManagementData, setCenterManagementData] = React.useState<CenterManagementData | null>(null);
  const [wastageData, setWastageData] = React.useState<WastageData | null>(null);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = React.useState(false);
  const [movementForm, setMovementForm] = React.useState({
    fromCenterId: '',
    toCenterId: '',
    vaccineName: '',
    quantity: 0,
    movementType: 'hub_to_center' as 'hub_to_center' | 'center_to_center' | 'center_to_hub',
    reason: '',
    temperatureMaintained: true,
  });

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const [usersResult, centersResult] = await Promise.all([getUsers(), getCenters()]);
    
    if (usersResult.success && usersResult.users) {
      setUsers(usersResult.users);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to load users',
        description: usersResult.error || 'An unknown error occurred.',
      });
    }

    if (centersResult.success && centersResult.centers) {
      setCenters(centersResult.centers);
    } else {
       toast({
        variant: 'destructive',
        title: 'Failed to load centers',
        description: centersResult.error || 'An unknown error occurred.',
      });
    }

    setIsLoading(false);
  }, [toast]);

  const fetchCenterManagementData = React.useCallback(async () => {
    const result = await getCenterManagementData();
    if (result.success && result.data) {
      setCenterManagementData(result.data);
    }
  }, []);

  const fetchWastageData = React.useCallback(async () => {
    const result = await getWastageData();
    if (result.success && result.data) {
      setWastageData(result.data);
    }
  }, []);


  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setLocalUser(parsedUser);
      if (parsedUser?.role !== 'authority') {
        router.push('/');
      }
    } else if (!isAuthLoading && !firebaseUser) {
       router.push('/login');
    }
  }, [isAuthLoading, firebaseUser, router]);

  React.useEffect(() => {
    if (localUser?.role === 'authority') {
      fetchData();
      fetchCenterManagementData();
      fetchWastageData();
    }
  }, [localUser, fetchData, fetchCenterManagementData, fetchWastageData]);

  const handleRoleChange = async (userId: string, newRole: 'citizen' | 'authority' | 'center') => {
    if (!firebaseUser) return;
    
    const currentUserFirebaseUid = firebaseUser.uid;
    const result = await updateUserRole({ targetUserId: userId, newRole, adminFirebaseUid: currentUserFirebaseUid });

    if (result.success) {
      toast({
        title: 'Success',
        description: 'User role updated successfully.',
      });
      router.refresh();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error updating role',
        description: result.error,
      });
    }
  };

  const handleApproveCenter = async (centerId: string) => {
    if (!firebaseUser) return;

    const result = await verifyCenter({ centerId, adminFirebaseUid: firebaseUser.uid });
    if (result.success) {
        toast({
            title: 'Center Approved!',
            description: 'The center is now active and can log in.',
        });
        router.refresh(); 
    } else {
        toast({
            variant: 'destructive',
            title: 'Approval Failed',
            description: result.error,
        });
    }
  };

  const handleRejectCenter = async (centerId: string) => {
    if (!firebaseUser) return;

    const result = await rejectCenter({ centerId, adminFirebaseUid: firebaseUser.uid });
    if (result.success) {
        toast({
            title: 'Center Rejected',
            description: 'The center registration has been removed.',
        });
        router.refresh();
    } else {
        toast({
            variant: 'destructive',
            title: 'Rejection Failed',
            description: result.error,
        });
    }
  };
  
  const handleRecordMovement = async () => {
    // Check if admin is logged in using localUser (from localStorage) or firebaseUser
    if (!localUser && !firebaseUser) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to record movements.',
      });
      return;
    }

    // Validate required fields
    if (!movementForm.toCenterId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a destination center.',
      });
      return;
    }

    if (!movementForm.vaccineName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a vaccine name.',
      });
      return;
    }

    if (movementForm.quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a valid quantity (greater than 0).',
      });
      return;
    }

    // Validate fromCenterId for center_to_center movement
    if (movementForm.movementType === 'center_to_center' && !movementForm.fromCenterId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a source center for center-to-center movement.',
      });
      return;
    }

    // Validate fromCenterId for center_to_hub movement
    if (movementForm.movementType === 'center_to_hub' && !movementForm.fromCenterId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a source center for center-to-hub movement.',
      });
      return;
    }
    
    // Prepare the data - convert empty string to null for fromCenterId
    // Get user email/name from localUser or firebaseUser
    const userEmail = localUser?.email || firebaseUser?.email || 'Admin';
    const userName = localUser?.firstName && localUser?.lastName 
      ? `${localUser.firstName} ${localUser.lastName}` 
      : userEmail;

    const movementData = {
      fromCenterId: movementForm.fromCenterId && movementForm.fromCenterId.trim() !== '' 
        ? movementForm.fromCenterId 
        : null,
      toCenterId: movementForm.toCenterId,
      vaccineName: movementForm.vaccineName.trim(),
      quantity: movementForm.quantity,
      movementType: movementForm.movementType,
      reason: movementForm.reason?.trim() || undefined,
      movedBy: userName, // Use name or email
      temperatureMaintained: movementForm.temperatureMaintained,
    };

    try {
      const result = await recordVaccineMovement(movementData);
      
      if (result.success) {
        toast({
          title: 'Movement Recorded',
          description: 'Vaccine movement has been recorded successfully.',
        });
        setIsMovementDialogOpen(false);
        setMovementForm({
          fromCenterId: '',
          toCenterId: '',
          vaccineName: '',
          quantity: 0,
          movementType: 'hub_to_center',
          reason: '',
          temperatureMaintained: true,
        });
        // Refresh ALL data to update both Supply Chain and Vaccination Centre Management
        await fetchData(); // This refreshes centers list
        await fetchCenterManagementData(); // This refreshes center management data
        await fetchWastageData(); // This refreshes wastage data
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to record movement. Please try again.',
        });
      }
    } catch (error: any) {
      console.error('Error recording movement:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An unexpected error occurred. Please try again.',
      });
    }
  };
  
  if (isAuthLoading || isLoading || localUser?.role !== 'authority') {
    return (
      <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 flex items-center justify-center">
              <p>Loading & Verifying Access...</p>
          </main>
          <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
        <Header />
        <main className="flex-1 py-12 px-4 md:px-6">
            <div className="container space-y-8">
                <header>
                    <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Manage users, centers, and system settings.</p>
                </header>

                <Tabs defaultValue="management" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="management">Center Management</TabsTrigger>
                    <TabsTrigger value="supply">Supply Chain & Wastage</TabsTrigger>
                    <TabsTrigger value="guidelines">Preservation Guidelines</TabsTrigger>
                  </TabsList>

                  <TabsContent value="management" className="space-y-4">
                    {/* Vaccination Centre Management Section */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Vaccination Centre Management</CardTitle>
                            <CardDescription>
                              Track vaccine stock, staff assignments, and daily capacity across all centers
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {centerManagementData && (
                          <div className="space-y-6">
                            {centerManagementData.centers.map((center) => {
                              const centerVaccines = centerManagementData.vaccines.filter(
                                (v: any) => v.centerId.toString() === center._id.toString()
                              );
                              const centerStaff = centerManagementData.staff.filter(
                                (s: any) => s.centerId.toString() === center._id.toString()
                              );
                              const totalStock = centerVaccines.reduce((sum: number, v: any) => sum + (v.remainingStock || 0), 0);
                              const totalWasted = centerVaccines.reduce((sum: number, v: any) => sum + (v.wastedDoses || 0), 0);
                              
                              return (
                                <div key={center._id} className="border rounded-lg p-4 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h3 className="font-semibold text-lg">{center.center_name}</h3>
                                      <p className="text-sm text-muted-foreground">{center.location.district}</p>
                                    </div>
                                    <Badge variant="outline">Capacity: {center.daily_capacity}/day</Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Vaccine Stock</span>
                                      </div>
                                      <div className="text-2xl font-bold">{totalStock}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {centerVaccines.length} vaccine types
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <UsersIcon className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Staff</span>
                                      </div>
                                      <div className="text-2xl font-bold">{centerStaff.length}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {centerStaff.filter((s: any) => s.role === 'Nurse').length} Nurses
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Wasted Doses</span>
                                      </div>
                                      <div className="text-2xl font-bold text-orange-600">{totalWasted}</div>
                                    </div>
                                  </div>
                                  
                                  {centerVaccines.length > 0 && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-medium mb-2">Vaccine Details:</h4>
                                      <div className="space-y-2">
                                        {centerVaccines.map((vaccine: any) => (
                                          <div key={vaccine._id} className="flex items-center justify-between p-2 bg-muted rounded">
                                            <span className="text-sm">{vaccine.vaccineName}</span>
                                            <div className="flex gap-4 text-xs">
                                              <span>Remaining: {vaccine.remainingStock}</span>
                                              <span>Used: {vaccine.usedDoses}</span>
                                              <span className="text-orange-600">Wasted: {vaccine.wastedDoses}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="supply" className="space-y-4">
                    {/* Supply Chain & Wastage Tracking */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Supply Chain Tracking</CardTitle>
                              <CardDescription>Monitor vaccine movement between hubs and centers</CardDescription>
                            </div>
                            <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm">
                                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                                  Record Movement
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Record Vaccine Movement</DialogTitle>
                                  <DialogDescription>
                                    Track vaccine transfers between hubs and centers
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>Movement Type</Label>
                                    <Select
                                      value={movementForm.movementType}
                                      onValueChange={(value: any) => setMovementForm({...movementForm, movementType: value})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="hub_to_center">Hub to Center</SelectItem>
                                        <SelectItem value="center_to_center">Center to Center</SelectItem>
                                        <SelectItem value="center_to_hub">Center to Hub</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {movementForm.movementType !== 'hub_to_center' && (
                                    <div>
                                      <Label>From Center</Label>
                                      <Select
                                        value={movementForm.fromCenterId}
                                        onValueChange={(value) => setMovementForm({...movementForm, fromCenterId: value})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select source center" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {centers.filter(c => c.verified).map(center => (
                                            <SelectItem key={center._id} value={center._id}>
                                              {center.center_name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <Label>To Center</Label>
                                    <Select
                                      value={movementForm.toCenterId}
                                      onValueChange={(value) => setMovementForm({...movementForm, toCenterId: value})}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select destination center" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {centers.filter(c => c.verified).map(center => (
                                          <SelectItem key={center._id} value={center._id}>
                                            {center.center_name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label>Vaccine Name</Label>
                                    <Input
                                      value={movementForm.vaccineName}
                                      onChange={(e) => setMovementForm({...movementForm, vaccineName: e.target.value})}
                                      placeholder="e.g., Pfizer, Moderna"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label>Quantity</Label>
                                    <Input
                                      type="number"
                                      value={movementForm.quantity}
                                      onChange={(e) => setMovementForm({...movementForm, quantity: parseInt(e.target.value) || 0})}
                                      min="1"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label>Reason (Optional)</Label>
                                    <Textarea
                                      value={movementForm.reason}
                                      onChange={(e) => setMovementForm({...movementForm, reason: e.target.value})}
                                      placeholder="Reason for movement"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="temperature"
                                      checked={movementForm.temperatureMaintained}
                                      onChange={(e) => setMovementForm({...movementForm, temperatureMaintained: e.target.checked})}
                                    />
                                    <Label htmlFor="temperature">Temperature Maintained</Label>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleRecordMovement}>
                                    Record Movement
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {centerManagementData?.movements.slice(0, 10).map((movement: any) => {
                              const toCenter = centers.find(c => c._id.toString() === movement.toCenterId.toString());
                              const fromCenter = movement.fromCenterId 
                                ? centers.find(c => c._id.toString() === movement.fromCenterId.toString())
                                : null;
                              
                              return (
                                <div key={movement._id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{movement.vaccineName}</span>
                                      <Badge variant="outline">{movement.quantity} doses</Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {fromCenter ? `${fromCenter.center_name} → ` : 'Hub → '}
                                      {toCenter?.center_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(movement.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  {movement.temperatureMaintained && (
                                    <Thermometer className="w-4 h-4 text-green-600" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Wastage Tracking & Prediction</CardTitle>
                          <CardDescription>
                            Monitor wastage trends and predict future wastage using data analysis
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {wastageData && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-sm text-muted-foreground">Total Wastage</div>
                                  <div className="text-2xl font-bold text-orange-600">{wastageData.totalWasted}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Wastage Rate</div>
                                  <div className="text-2xl font-bold">{wastageData.wastageRate}%</div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="w-4 h-4" />
                                  <span className="font-medium">High Risk Centers</span>
                                </div>
                                <div className="space-y-2">
                                  {wastageData.highRiskCenters.length > 0 ? (
                                    wastageData.highRiskCenters.map((center: any) => {
                                      const centerInfo = centers.find(c => c._id.toString() === center.centerId);
                                      return (
                                        <div key={center.centerId} className="p-3 border border-orange-200 rounded-lg bg-orange-50">
                                          <div className="font-medium">{centerInfo?.center_name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            Current Wastage Rate: {center.wastageRate.toFixed(2)}%
                                          </div>
                                          <div className="text-sm text-orange-600 mt-1">
                                            Predicted Wastage: ~{Math.round(center.predictedWastage)} doses
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-sm text-muted-foreground p-3 border rounded-lg">
                                      No high-risk centers identified
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <BarChart3 className="w-4 h-4" />
                                  <span className="font-medium">Wastage by Center</span>
                                </div>
                                <div className="space-y-2">
                                  {wastageData.centerWastage
                                    .sort((a: any, b: any) => b.wastageRate - a.wastageRate)
                                    .slice(0, 5)
                                    .map((center: any) => {
                                      const centerInfo = centers.find(c => c._id.toString() === center.centerId);
                                      return (
                                        <div key={center.centerId} className="flex items-center justify-between p-2 border rounded">
                                          <span className="text-sm">{centerInfo?.center_name || 'Unknown'}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">{center.wastageRate.toFixed(1)}%</span>
                                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-orange-600"
                                                style={{ width: `${Math.min(center.wastageRate, 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="guidelines" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Vaccine Preservation Guidelines</CardTitle>
                        <CardDescription>
                          Essential guidelines for proper vaccine storage and handling
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                              <Thermometer className="w-5 h-5 text-primary" />
                              Temperature Requirements
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-7">
                              <li>Most vaccines require storage at 2°C to 8°C (36°F to 46°F)</li>
                              <li>Some vaccines (e.g., mRNA vaccines) require ultra-cold storage (-70°C to -20°C)</li>
                              <li>Monitor temperature continuously using data loggers</li>
                              <li>Maintain temperature logs and review daily</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-primary" />
                              Storage Best Practices
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-7">
                              <li>Store vaccines in original packaging until ready to use</li>
                              <li>Organize by expiry date - use first-expiring vaccines first (FEFO)</li>
                              <li>Do not store vaccines in refrigerator door compartments</li>
                              <li>Maintain adequate spacing for proper air circulation</li>
                              <li>Keep vaccines away from freezer walls and cooling elements</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-primary" />
                              Wastage Prevention
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-7">
                              <li>Implement proper inventory management systems</li>
                              <li>Track expiry dates and rotate stock regularly</li>
                              <li>Train staff on proper handling procedures</li>
                              <li>Monitor wastage rates and investigate high wastage centers</li>
                              <li>Plan vaccination schedules to minimize vial opening</li>
                              <li>Use multi-dose vials efficiently within recommended timeframes</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                              <Package className="w-5 h-5 text-primary" />
                              Transport Guidelines
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-7">
                              <li>Use validated cold chain containers for transport</li>
                              <li>Pre-cool containers before loading vaccines</li>
                              <li>Monitor temperature during transit</li>
                              <li>Minimize transport time and avoid unnecessary handling</li>
                              <li>Document all movements and temperature readings</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{users.length}</div>
                            <p className="text-xs text-muted-foreground">All registered users in the system</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Centers</CardTitle>
                            <Hospital className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{centers.length}</div>
                            <p className="text-xs text-muted-foreground">All registered vaccination centers</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                            <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{centers.filter(c => !c.verified).length}</div>
                            <p className="text-xs text-muted-foreground">Centers awaiting approval</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid gap-8 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Center Management</CardTitle>
                            <CardDescription>Approve or reject new vaccination center registrations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Center Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {centers.map((center) => (
                                        <TableRow key={center._id}>
                                            <TableCell className="font-medium">{center.center_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={center.verified ? 'default' : 'secondary'} className={center.verified ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>
                                                    {center.verified ? 'Approved' : 'Pending'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {!center.verified ? (
                                                  <div className="flex justify-end gap-2">
                                                    <Button size="sm" onClick={() => handleApproveCenter(center._id)}>Approve</Button>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="destructive">Reject</Button>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                          <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the registration for "{center.center_name}".
                                                          </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => handleRejectCenter(center._id)}>
                                                            Yes, reject
                                                          </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                ) : (
                                                  <span className="text-sm text-muted-foreground">No actions</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>Manage user roles in the system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                                        <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleRoleChange(user._id, 'citizen')}>
                                                    Make Citizen
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleRoleChange(user._id, 'authority')}>
                                                    Make Authority
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleRoleChange(user._id, 'center')}>
                                                    Make Center
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
        <Footer />
    </div>
  );
}
