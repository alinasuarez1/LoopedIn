import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Eye, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Helper function to check if a date is valid
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

interface Newsletter {
  id: number;
  content: string;
  status: 'draft' | 'finalized' | 'sent';
  urlId: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  loopId: number;
}

export default function NewsletterEditor() {
  const { loopId, newsletterId } = useParams<{ loopId: string, newsletterId: string }>();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  // Fetch newsletter data
  const { data: newsletter, isLoading, error } = useQuery<Newsletter>({
    queryKey: [`/api/loops/${loopId}/newsletters/${newsletterId}/preview`],
  });

  // Set content when newsletter data is loaded
  useEffect(() => {
    if (newsletter?.content) {
      setContent(newsletter.content);
    }
  }, [newsletter]);

  // Format date helper - robust date formatting with validation
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not yet';
    try {
      const date = new Date(dateStr);

      if (!isValidDate(date)) {
        console.error('Invalid date detected:', dateStr);
        return 'Date not available';
      }

      return format(date, 'PPP'); // Using PPP for more detailed format
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date not available';
    }
  };

  // Update newsletter content
  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${loopId}/newsletters/${newsletterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Changes saved",
        description: "Newsletter draft has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  // Finalize newsletter
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${loopId}/newsletters/${newsletterId}/finalize`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Newsletter Finalized",
        description: "The newsletter has been finalized and is ready to send.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize newsletter",
        variant: "destructive",
      });
    },
  });

  // Send newsletter to all members
  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/loops/${loopId}/newsletters/${newsletterId}/send`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Newsletter sent",
        description: "The newsletter has been sent to all loop members.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send newsletter",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !newsletter) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error?.message || "Failed to load newsletter"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canFinalize = newsletter.status === 'draft';
  const canSend = newsletter.status === 'finalized';

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Newsletter Draft</CardTitle>
          <CardDescription>
            Make changes to the newsletter before sending it to loop members
          </CardDescription>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Created on {formatDate(newsletter?.createdAt)}</p>
            <p>Last updated on {formatDate(newsletter?.updatedAt)}</p>
            {newsletter?.sentAt && <p>Sent on {formatDate(newsletter?.sentAt)}</p>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !canFinalize}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/newsletters/${newsletter.urlId}`, '_blank')}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            {canFinalize && (
              <Button
                variant="outline"
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Finalize
                  </>
                )}
              </Button>
            )}
            {canSend && (
              <Button
                variant="default"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Members
                  </>
                )}
              </Button>
            )}
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[500px] font-mono"
            placeholder="Loading newsletter content..."
            disabled={!canFinalize}
          />
        </CardContent>
      </Card>
    </div>
  );
}