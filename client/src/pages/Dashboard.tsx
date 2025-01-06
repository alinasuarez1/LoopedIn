import { useState } from 'react';
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
import { Plus, Loader2, Users2, MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const vibeOptions = [
  { label: "Fun", value: "fun" },
  { label: "Casual", value: "casual" },
  { label: "Funny", value: "funny" },
  { label: "Formal", value: "formal" },
  { label: "Deep", value: "deep" },
];

type CreateLoopForm = {
  name: string;
  frequency: "biweekly" | "monthly";
  context?: string;
};

export default function Dashboard() {
  const { user } = useUser();
  const { loops, isLoading, createLoop } = useLoops();
  const { toast } = useToast();
  const form = useForm<CreateLoopForm>();
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const onSubmit = async (data: CreateLoopForm) => {
    try {
      if (selectedVibes.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one newsletter vibe",
          variant: "destructive",
        });
        return;
      }

      const response = await createLoop({
        ...data,
        vibe: selectedVibes,
        creatorId: user!.id,
        reminderSchedule: ["Wednesday", "Friday", "Sunday"],
      });

      toast({
        title: "Success",
        description: "Loop created successfully!" + 
          (response.smsStatus === 'disabled' 
            ? " SMS notifications are currently disabled." 
            : ""),
      });

      // Reset form and close dialog
      form.reset();
      setSelectedVibes([]);
      setIsDialogOpen(false);
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

  const CreateLoopDialog = () => (
    <Dialog open={isDialogOpen} onOpenChange={(open) => {
      setIsDialogOpen(open);
      if (!open) {
        form.reset();
        setSelectedVibes([]);
      }
    }}>
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
            <Label>Newsletter Vibe</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select the tone and style for your newsletters. Choose one or more options that best fit your group.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {vibeOptions.map((vibe) => (
                <div key={vibe.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={vibe.value}
                    checked={selectedVibes.includes(vibe.value)}
                    onCheckedChange={(checked) => {
                      setSelectedVibes(prev =>
                        checked
                          ? [...prev, vibe.value]
                          : prev.filter(v => v !== vibe.value)
                      );
                    }}
                  />
                  <label
                    htmlFor={vibe.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {vibe.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">Group Context</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Add details about your group to help personalize the newsletters. For example: "Family updates from our cross-country clan" or "Weekly progress from the website redesign team"
            </p>
            <Input
              id="context"
              {...form.register("context")}
              placeholder="What brings your group together?"
            />
          </div>
          <Button type="submit" className="w-full">
            Create Loop
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Loops</h1>
        <CreateLoopDialog />
      </div>

      {!loops?.length ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Users2 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">Create Your First Loop</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Start by creating a Loop to keep your group connected. Share updates via text and let us generate beautiful newsletters automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Share updates via SMS</span>
                </div>
                <div className="hidden sm:block">•</div>
                <div className="flex items-center gap-2">
                  <Users2 className="h-4 w-4" />
                  <span>Connect with your group</span>
                </div>
              </div>
              <CreateLoopDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loops.map((loop) => (
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
      )}
    </div>
  );
}