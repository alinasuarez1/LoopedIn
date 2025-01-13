import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";

interface BulkSMSDialogProps {
  loopId: number;
  loopName: string;
  memberCount: number;
}

interface BulkSMSFormData {
  message: string;
}

function BulkSMSDialogComponent({ loopId, loopName, memberCount }: BulkSMSDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { handleSubmit, register, formState: { isSubmitting }, reset } = useForm<BulkSMSFormData>({
    defaultValues: {
      message: "",
    }
  });

  const onSubmit = useCallback(async (data: BulkSMSFormData) => {
    if (!data.message.trim()) return;

    try {
      const response = await fetch(`/api/admin/loops/${loopId}/bulk-sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Messages sent successfully!",
      });

      reset();
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send messages",
        variant: "destructive",
      });
    }
  }, [loopId, toast, reset, setIsOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      reset();
    }
    setIsOpen(open);
  }, [reset]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Send Group Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Message to All Members</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This message will be sent to all {memberCount} members of {loopName}.
          </p>
          <Textarea
            {...register("message", { required: true })}
            placeholder="Type your message here..."
            className="min-h-[100px]"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Message"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const BulkSMSDialog = memo(BulkSMSDialogComponent);
