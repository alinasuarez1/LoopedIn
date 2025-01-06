import { useLoops } from "../hooks/use-loops";
import { useUser } from "../hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CreateLoopForm = {
  name: string;
  frequency: "biweekly" | "monthly";
  vibe: string[];
  context?: string;
};

export default function Dashboard() {
  const { user } = useUser();
  const { loops, isLoading, createLoop } = useLoops();
  const { toast } = useToast();
  const form = useForm<CreateLoopForm>();

  const onSubmit = async (data: CreateLoopForm) => {
    try {
      await createLoop({
        ...data,
        creatorId: user!.id,
        reminderSchedule: ["Wednesday", "Friday", "Sunday"],
      });
      toast({
        title: "Success",
        description: "Loop created successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Loops</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Loop
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Loop</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Loop Name</Label>
                <Input
                  id="name"
                  {...form.register("name", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Newsletter Frequency</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue("frequency", value as "biweekly" | "monthly")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biweekly">Every Two Weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="context">Context (Optional)</Label>
                <Input
                  id="context"
                  {...form.register("context")}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Loop
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loops?.map((loop) => (
          <Link key={loop.id} href={`/loops/${loop.id}`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{loop.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Frequency: {loop.frequency}
                </p>
                {loop.context && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {loop.context}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
