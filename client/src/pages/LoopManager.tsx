import { useLoop } from "../hooks/use-loops";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoopManager() {
  const { id } = useParams<{ id: string }>();
  const { loop, isLoading } = useLoop(parseInt(id));
  const { toast } = useToast();

  if (isLoading || !loop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>{loop.name}</CardTitle>
          <CardDescription>
            Created on {new Date(loop.createdAt!).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="updates">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="updates">Updates</TabsTrigger>
              <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="updates" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
              {/* Updates list will go here */}
            </TabsContent>
            <TabsContent value="newsletters" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Newsletters</h3>
              {/* Newsletters list will go here */}
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Members</h3>
              {/* Members list will go here */}
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Loop Settings</h3>
              {/* Settings form will go here */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
