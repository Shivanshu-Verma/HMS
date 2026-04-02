"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { store } from "@/lib/demo-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Mail,
  Phone,
  Shield,
  Settings,
  Key,
  UserPlus,
  Edit,
  Trash2,
  Save,
  X,
  Building,
  Clock,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { User as UserType, UserRole } from "@/lib/types";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [users, setUsers] = useState<UserType[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  // New user state
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "" as UserRole | "",
    password: "",
  });

  useEffect(() => {
    setUsers(store.getUsers());
    if (user) {
      setProfileData({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleSaveProfile = () => {
    if (!profileData.full_name || !profileData.email) {
      toast.error("Name and email are required");
      return;
    }
    // In a real app, this would update the user in the backend
    toast.success("Profile updated successfully");
    setIsEditingProfile(false);
  };

  const handleAddUser = () => {
    if (!newUser.full_name || !newUser.email || !newUser.role || !newUser.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    const userToAdd: UserType = {
      id: `user-${Date.now()}`,
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role as UserRole,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.addUser(userToAdd);
    setUsers(store.getUsers());
    toast.success(`${newUser.full_name} has been added as ${newUser.role}`);
    setNewUser({ full_name: "", email: "", phone: "", role: "", password: "" });
    setIsAddingUser(false);
  };

  const handleEditUser = (u: UserType) => {
    setEditingUser({ ...u });
    setIsEditOpen(true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    store.updateUser(editingUser.id, editingUser);
    setUsers(store.getUsers());
    toast.success("User updated successfully");
    setIsEditOpen(false);
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === user?.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    store.deleteUser(userId);
    setUsers(store.getUsers());
    toast.success("User deleted successfully");
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "reception":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "counsellor":
        return "bg-green-100 text-green-800 border-green-200";
      case "doctor":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "pharmacist":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const initials = user?.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "AD";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, users, and system settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            My Profile
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Shield className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            System Settings
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Profile Card */}
            <Card className="md:col-span-1 border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-[#0d7377] to-[#14919b] text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="mt-4 text-xl font-semibold">{user?.full_name}</h3>
                  <Badge className={`mt-2 ${getRoleBadgeColor(user?.role || 'admin')}`}>
                    <Shield className="mr-1 h-3 w-3" />
                    {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
                  </Badge>
                  <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user?.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Aggarwal Hospital</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile Card */}
            <Card className="md:col-span-2 border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </div>
                  {!isEditingProfile && (
                    <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={user?.role || ""} disabled className="capitalize" />
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveProfile}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Card */}
            <Card className="md:col-span-3 border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your password and security preferences</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <Input type="password" placeholder="Enter current password" />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input type="password" placeholder="Confirm new password" />
                  </div>
                </div>
                <Button className="mt-4">
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>{users.length} registered users</CardDescription>
                </div>
                <Button onClick={() => setIsAddingUser(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {u.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(u.role)}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "secondary"} className={u.is_active ? "bg-green-100 text-green-800" : ""}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(u)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Hospital Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Hospital Name</Label>
                  <Input defaultValue="Aggarwal Psychiatric & De-Addiction Centre" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input defaultValue="123 Hospital Road, City" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input defaultValue="+91 9876543210" />
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Operating Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Opening Time</Label>
                    <Input type="time" defaultValue="09:00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Closing Time</Label>
                    <Input type="time" defaultValue="18:00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <Badge key={day} variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-800">Database</span>
                    </div>
                    <p className="mt-1 text-xs text-green-600">Connected</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-800">Biometric</span>
                    </div>
                    <p className="mt-1 text-xs text-green-600">Online</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-800">Printer</span>
                    </div>
                    <p className="mt-1 text-xs text-green-600">Ready</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-800">Backup</span>
                    </div>
                    <p className="mt-1 text-xs text-green-600">Last: Today 3:00 AM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="counsellor">Counsellor</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editingUser.phone || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="counsellor">Counsellor</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingUser.is_active ? "active" : "inactive"}
                  onValueChange={(value) => setEditingUser({ ...editingUser, is_active: value === "active" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
