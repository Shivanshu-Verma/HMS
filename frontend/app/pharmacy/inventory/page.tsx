'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { addMedicine, addMedicineStock, getInventory, type PharmacyInventoryItemResponse } from '@/lib/hms-api';
import { useAuth } from '@/lib/auth-context';
import type { Medicine, MedicineUnit } from '@/lib/types';
import { StockBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
} from 'lucide-react';

const LOW_STOCK_THRESHOLD = 20;

interface InventoryMedicineItem {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  unit: MedicineUnit;
  unit_price: number;
  stock_quantity: number;
  is_active: boolean;
}

interface AddMedicineFormState {
  name: string;
  category: string;
  manufacturer: string;
  unit: MedicineUnit;
  price_per_unit: number;
  stock_quantity: number;
}

export default function InventoryPage() {
  const { accessToken } = useAuth();
  const [medicines, setMedicines] = useState<InventoryMedicineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<InventoryMedicineItem | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);

  const [newMedicine, setNewMedicine] = useState<AddMedicineFormState>({
    name: '',
    category: '',
    manufacturer: '',
    unit: 'tablet' as MedicineUnit,
    price_per_unit: 0,
    stock_quantity: 0,
  });

  const mapInventoryItems = (items: PharmacyInventoryItemResponse[]): InventoryMedicineItem[] => {
    return (items || []).map((item) => ({
      id: item.medicine_id,
      name: item.name,
      category: item.category,
      manufacturer: item.description,
      unit: item.unit,
      unit_price: item.unit_price,
      stock_quantity: item.stock_quantity,
      is_active: item.is_active,
    }));
  };

  const loadInventory = () => {
    if (!accessToken) return;

    getInventory(accessToken)
      .then((res) => {
        setMedicines(mapInventoryItems(res.items || []));
      })
      .catch(() => setMedicines([]));
  };

  useEffect(() => {
    loadInventory();
  }, [accessToken]);

  const filteredMedicines = medicines.filter((med) => {
    const matchesSearch =
      !searchQuery ||
      med.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStock === 'all' ||
      (filterStock === 'low' && med.stock_quantity <= LOW_STOCK_THRESHOLD && med.stock_quantity > 0) ||
      (filterStock === 'out' && med.stock_quantity === 0);

    return matchesSearch && matchesFilter;
  });

  const handleAddMedicine = () => {
    if (!accessToken) {
      toast.error('Please sign in again');
      return;
    }
    if (!newMedicine.name || newMedicine.price_per_unit <= 0) {
      toast.error('Please fill in required fields');
      return;
    }

    addMedicine(accessToken, {
      name: newMedicine.name,
      category: newMedicine.category || 'general',
      unit: newMedicine.unit,
      unit_price: newMedicine.price_per_unit,
      stock_quantity: newMedicine.stock_quantity,
      description: newMedicine.manufacturer || '',
    })
      .then(() => {
        loadInventory();
        setShowAddDialog(false);
        setNewMedicine({
          name: '',
          category: '',
          manufacturer: '',
          unit: 'tablet',
          price_per_unit: 0,
          stock_quantity: 0,
        });
        toast.success('Medicine added successfully!');
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to add medicine');
      });
  };

  const handleAddStock = () => {
    if (!accessToken) {
      toast.error('Please sign in again');
      return;
    }
    if (!selectedMedicine || stockToAdd <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    addMedicineStock(accessToken, selectedMedicine.id, stockToAdd)
      .then(() => {
        loadInventory();
        setShowStockDialog(false);
        setSelectedMedicine(null);
        setStockToAdd(0);
        toast.success('Stock added successfully!');
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to add stock');
      });
  };

  const lowStockCount = medicines.filter(
    (m) => m.stock_quantity <= LOW_STOCK_THRESHOLD && m.stock_quantity > 0
  ).length;
  const outOfStockCount = medicines.filter((m) => m.stock_quantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground">Manage medicine stock and details</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Medicine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Medicine</DialogTitle>
              <DialogDescription>Enter medicine details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={newMedicine.name}
                  onChange={(e) =>
                    setNewMedicine({ ...newMedicine, name: e.target.value })
                  }
                  placeholder="Medicine name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={newMedicine.category}
                    onChange={(e) =>
                      setNewMedicine({ ...newMedicine, category: e.target.value })
                    }
                    placeholder="Category"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={newMedicine.unit}
                    onValueChange={(v) =>
                      setNewMedicine({ ...newMedicine, unit: v as MedicineUnit })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="capsule">Capsule</SelectItem>
                      <SelectItem value="ml">ML</SelectItem>
                      <SelectItem value="mg">MG</SelectItem>
                      <SelectItem value="syrup">Syrup</SelectItem>
                      <SelectItem value="injection">Injection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Price per Unit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    value={newMedicine.price_per_unit || ''}
                    onChange={(e) =>
                      setNewMedicine({
                        ...newMedicine,
                        price_per_unit: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={newMedicine.stock_quantity || ''}
                    onChange={(e) =>
                      setNewMedicine({
                        ...newMedicine,
                        stock_quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Unit must be one of: tablet, capsule, ml, mg, syrup, injection.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMedicine}>Add Medicine</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{medicines.length}</p>
                <p className="text-sm text-muted-foreground">Total Medicines</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={lowStockCount > 0 ? 'border-amber-200 bg-amber-50' : ''}
          onClick={() => setFilterStock(filterStock === 'low' ? 'all' : 'low')}
        >
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={outOfStockCount > 0 ? 'border-red-200 bg-red-50' : ''}
          onClick={() => setFilterStock(filterStock === 'out' ? 'all' : 'out')}
        >
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medicines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStock} onValueChange={(v: 'all' | 'low' | 'out') => setFilterStock(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMedicines.length > 0 ? (
                filteredMedicines.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{med.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>{med.category || '-'}</TableCell>
                    <TableCell className="capitalize">{med.unit}</TableCell>
                    <TableCell className="text-right">Rs. {(med.unit_price || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{med.stock_quantity}</TableCell>
                    <TableCell>
                      <StockBadge quantity={med.stock_quantity} reorderLevel={LOW_STOCK_THRESHOLD} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedMedicine(med);
                          setShowStockDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Stock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No medicines found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Stock Dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              Add stock for {selectedMedicine?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="quantity">Quantity to Add</Label>
            <Input
              id="quantity"
              type="number"
              value={stockToAdd || ''}
              onChange={(e) => setStockToAdd(parseInt(e.target.value) || 0)}
              placeholder="Enter quantity"
              className="mt-2"
              min={1}
            />
            {selectedMedicine && (
              <p className="text-sm text-muted-foreground mt-2">
                Current stock: {selectedMedicine.stock_quantity} |
                New stock: {selectedMedicine.stock_quantity + stockToAdd}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStock}>Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
