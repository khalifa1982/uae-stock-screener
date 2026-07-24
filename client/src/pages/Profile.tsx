import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Phone, Mail, Calendar, Shield, Pencil, Check, X, Crown } from "lucide-react";

const AVATAR_EMOJIS = [
  "🦁", "🐯", "🦊", "🐺", "🦅", "🐉", "🦈", "🐬",
  "🦉", "🐻", "🦇", "🐸", "🦋", "🐝", "🦄", "🐙",
  "🦀", "🐢", "🦎", "🐍", "🦩", "🦚", "🐧", "🐨",
  "🦘", "🦥", "🦦", "🦫", "🐼", "🦭", "🐳", "🦬",
];

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const profileQuery = trpc.auth.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      toast.success("Profile updated");
      setEditingField(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditMobile(profile.mobileNumber || "");
    }
  }, [profile]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md" style={{ background: "oklch(0.12 0.014 260)" }}>
          <CardContent className="p-8 text-center">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground">Please sign in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  const currentEmoji = profile?.avatarEmoji || "🦁";

  const handleSaveName = () => {
    if (editName.trim()) {
      updateMutation.mutate({ name: editName.trim() });
    }
  };

  const handleSaveMobile = () => {
    updateMutation.mutate({ mobileNumber: editMobile.trim() || null });
  };

  const handleSelectEmoji = (emoji: string) => {
    updateMutation.mutate({ avatarEmoji: emoji });
    setShowEmojiPicker(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl transition-all hover:scale-110 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, oklch(0.75 0.17 85), oklch(0.65 0.2 50))",
              boxShadow: "0 0 20px oklch(0.75 0.17 85 / 30%)",
            }}
            title="Click to change avatar"
          >
            {currentEmoji}
          </button>
          <div
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: "oklch(0.25 0.014 260)", border: "2px solid oklch(0.12 0.014 260)" }}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <Card className="mx-auto max-w-sm" style={{ background: "oklch(0.15 0.014 260)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Choose Your Avatar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-2">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSelectEmoji(emoji)}
                    className={`w-9 h-9  flex items-center justify-center text-xl transition-all hover:scale-125 ${
                      emoji === currentEmoji ? "ring-2 ring-primary" : ""
                    }`}
                    style={{
                      background: emoji === currentEmoji ? "oklch(0.25 0.05 195)" : "oklch(0.18 0.014 260)",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h1 className="text-2xl font-bold">{profile?.name || "User"}</h1>
          {profile?.role === "admin" && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: "oklch(0.75 0.17 85 / 20%)", color: "oklch(0.85 0.17 85)" }}>
              <Crown className="h-3 w-3" /> Admin
            </span>
          )}
        </div>
      </div>

      {/* Profile Fields */}
      <Card style={{ background: "oklch(0.12 0.014 260)", border: "1px solid oklch(0.20 0.014 260)" }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>Manage your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Display Name</p>
                {editingField === "name" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      style={{ background: "oklch(0.10 0.014 260)" }}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    />
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-400" onClick={handleSaveName} disabled={updateMutation.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400" onClick={() => setEditingField(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium truncate">{profile?.name || "Not set"}</p>
                )}
              </div>
            </div>
            {editingField !== "name" && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingField("name"); setEditName(profile?.name || ""); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="text-sm font-medium truncate">{profile?.email || "Not set"}</p>
              </div>
            </div>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Mobile Number */}
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Mobile Number</p>
                {editingField === "mobile" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      className="h-8 text-sm"
                      style={{ background: "oklch(0.10 0.014 260)" }}
                      placeholder="+971 50 123 4567"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveMobile()}
                    />
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-400" onClick={handleSaveMobile} disabled={updateMutation.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400" onClick={() => setEditingField(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium truncate">{profile?.mobileNumber || "Not set"}</p>
                )}
              </div>
            </div>
            {editingField !== "mobile" && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingField("mobile"); setEditMobile(profile?.mobileNumber || ""); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Member Since */}
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-AE", {
                    year: "numeric", month: "long", day: "numeric"
                  }) : "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card style={{ background: "oklch(0.12 0.014 260)", border: "1px solid oklch(0.20 0.014 260)" }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div>
              <p className="text-xs text-muted-foreground">Account Type</p>
              <p className="text-sm font-medium capitalize">{profile?.role || "user"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 " style={{ background: "oklch(0.15 0.014 260)" }}>
            <div>
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="text-sm font-mono text-muted-foreground truncate">{profile?.openId?.slice(0, 16)}...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
