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
import { formatDateTime } from "@/lib/date";
import { type Newsletter } from "@/types/newsletter";

export default function NewsletterEditor() {
  const { loopId, newsletterId } = useParams<{ loopId: string, newsletterId: string }>();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  // Fetch newsletter data
  const { data: newsletter, isLoading, error, refetch } = useQuery<Newsletter>({
    queryKey: [`/api/loops/${loopId}/newsletters/${newsletterId}`],
    retry: false,
  });

  useEffect(() => {
    if (newsletter?.content) {
      setContent(newsletter.content);
    }
  }, [newsletter]);

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
        title: "Success",
        description: "Newsletter draft has been updated.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
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
        title: "Success",
        description: "Newsletter has been finalized and is ready to send.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to finalize newsletter",
        variant: "destructive",
      });
    },
  });

  // Send newsletter
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
        title: "Success",
        description: "Newsletter has been sent to all loop members.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send newsletter",
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
            <p>{error instanceof Error ? error.message : "Failed to load newsletter"}</p>
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
          <CardTitle>Newsletter Editor</CardTitle>
          <CardDescription>
            Make changes to the newsletter before sending it to loop members
          </CardDescription>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Created: {formatDateTime(newsletter.createdAt)}</p>
            <p>Last updated: {formatDateTime(newsletter.updatedAt)}</p>
            {newsletter.sentAt && <p>Sent: {formatDateTime(newsletter.sentAt)}</p>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            {canFinalize && (
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
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
            )}

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