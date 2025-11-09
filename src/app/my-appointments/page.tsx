'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarCheck, MapPin, Phone, Mail, Hospital, Clock, Syringe, AlertCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { getUserAppointments } from './actions';
import Link from 'next/link';

type AppointmentData = {
    _id: string;
    appointmentDate: string;
    vaccineType: string;
    doseNumber: number;
    status: 'Pending' | 'Scheduled' | 'Administered' | 'Cancelled';
    centerId: {
        _id: string;
        center_name: string;
        location: {
            district: string;
            address: string;
        };
        phone: string;
        email: string;
    };
};

export default function MyAppointmentsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [appointments, setAppointments] = React.useState<AppointmentData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [userInfo, setUserInfo] = React.useState<any>(null);
    const [citizenInfo, setCitizenInfo] = React.useState<any>(null);

    const fetchAppointments = React.useCallback(async (email: string) => {
        setIsLoading(true);
        const result = await getUserAppointments(email);
        
        if (result.success) {
            setAppointments(result.appointments || []);
            if (result.citizen) {
                setCitizenInfo(result.citizen);
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Failed to Load Appointments',
                description: result.error || 'An unknown error occurred.',
            });
        }
        setIsLoading(false);
    }, [toast]);

    React.useEffect(() => {
        const checkAuth = () => {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                toast({
                    variant: 'destructive',
                    title: 'Authentication Required',
                    description: 'Please log in to view your appointments.',
                });
                router.push('/login');
                return;
            }

            try {
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser?.email) {
                    setUserEmail(parsedUser.email);
                    setUserInfo(parsedUser);
                    fetchAppointments(parsedUser.email);
                } else {
                    router.push('/login');
                }
            } catch (error) {
                console.error('Failed to parse user data:', error);
                router.push('/login');
            }
        };

        checkAuth();
        
        // Also refresh when page gains focus (e.g., after returning from booking)
        const handleFocus = () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser?.email) {
                        fetchAppointments(parsedUser.email);
                    }
                } catch (error) {
                    console.error('Failed to refresh appointments:', error);
                }
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [router, toast, fetchAppointments]);

    // Refresh appointments when page becomes visible (e.g., after booking)
    React.useEffect(() => {
        if (!userEmail) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchAppointments(userEmail);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [userEmail, fetchAppointments]);

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            'Pending': 'secondary',
            'Scheduled': 'default',
            'Administered': 'default',
            'Cancelled': 'destructive',
        };

        return (
            <Badge variant={variants[status] || 'default'}>
                {status}
            </Badge>
        );
    };

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 flex items-center justify-center py-12 px-4">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading your appointments...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 py-12 px-4">
                <div className="container max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold font-headline mb-2">My Appointments</h1>
                        <p className="text-muted-foreground">View and manage your vaccination appointments</p>
                    </div>

                    {/* User Information Card */}
                    {userInfo && (
                        <Card className="mb-6 bg-primary/5 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-2">
                                            {userInfo.firstName} {userInfo.lastName}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-1">
                                            <Mail className="w-4 h-4 inline mr-1" />
                                            {userInfo.email}
                                        </p>
                                        {citizenInfo && (
                                            <p className="text-sm text-muted-foreground">
                                                <ShieldCheck className="w-4 h-4 inline mr-1" />
                                                Registered Citizen • {citizenInfo.idType === 'nid' ? 'National ID' : citizenInfo.idType === 'passport' ? 'Passport' : 'Birth Certificate'}: {citizenInfo.idNumber}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-muted-foreground">Total Appointments</p>
                                        <p className="text-2xl font-bold text-primary">{appointments.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {appointments.length === 0 ? (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center py-12">
                                    <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">No Appointments Found</h3>
                                    <p className="text-muted-foreground mb-6">
                                        You don't have any vaccination appointments yet. Schedule your first appointment to get started.
                                    </p>
                                    <Link href="/appointment/book">
                                        <Button size="lg">
                                            <CalendarCheck className="w-5 h-5 mr-2" />
                                            Schedule Appointment
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {appointments.map((appointment) => (
                                <Card key={appointment._id} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="flex items-center gap-2 mb-2">
                                                    <Syringe className="w-5 h-5 text-primary" />
                                                    {appointment.vaccineType} - Dose {appointment.doseNumber}
                                                </CardTitle>
                                                <CardDescription className="flex items-center gap-2 mt-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {format(new Date(appointment.appointmentDate), 'EEEE, MMMM dd, yyyy')}
                                                </CardDescription>
                                            </div>
                                            <div>
                                                {getStatusBadge(appointment.status)}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {/* Center Information */}
                                            <div className="border-t pt-4">
                                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                    <Hospital className="w-4 h-4 text-primary" />
                                                    Vaccination Center
                                                </h4>
                                                <div className="space-y-2 pl-6">
                                                    <div className="flex items-start gap-2">
                                                        <Hospital className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                        <span className="font-medium">{appointment.centerId.center_name}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                        <span className="text-sm text-muted-foreground">
                                                            {appointment.centerId.location.address}, {appointment.centerId.location.district}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                        <span className="text-sm text-muted-foreground">{appointment.centerId.phone}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                        <span className="text-sm text-muted-foreground">{appointment.centerId.email}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Appointment Status Info */}
                                            {appointment.status === 'Pending' && (
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                                                    <div className="flex items-start gap-2">
                                                        <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                                            Your appointment is pending confirmation from the vaccination center. You will be notified once it's confirmed.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {appointment.status === 'Scheduled' && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                                                    <div className="flex items-start gap-2">
                                                        <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                                        <p className="text-sm text-blue-800 dark:text-blue-200">
                                                            Your appointment has been confirmed. Please arrive at the center on the scheduled date.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {appointment.status === 'Administered' && (
                                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                                                    <div className="flex items-start gap-2">
                                                        <Syringe className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                                                        <p className="text-sm text-green-800 dark:text-green-200">
                                                            This dose has been successfully administered. Thank you for getting vaccinated!
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            
                            {/* Add New Appointment Button */}
                            <Card className="border-dashed">
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <p className="text-muted-foreground mb-4">Need to schedule another appointment?</p>
                                        <Link href="/appointment/book">
                                            <Button variant="outline">
                                                <CalendarCheck className="w-4 h-4 mr-2" />
                                                Schedule New Appointment
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}

