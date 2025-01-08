import { useUser } from "../hooks/use-user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => setLocation('/')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
            <p className="mt-1 text-lg">{user.firstName} {user.lastName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
            <p className="mt-1 text-lg">{user.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Phone Number</h3>
            <p className="mt-1 text-lg">{user.phoneNumber}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}