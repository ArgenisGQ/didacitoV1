import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Save, UploadCloud, X, AlertCircle, Building, BookOpen, Layers, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api-client';

interface Faculty {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

interface Career {
  id: number;
  name: string;
  code: string;
  faculty_id: number;
  faculty_code?: string;
  is_active: boolean;
}

interface Department {
  id: number;
  name: string;
  code: string;
  faculty_id: number;
  faculty_code?: string;
  subject_codes?: string;
  is_active: boolean;
}

export function AcademicDistribution() {
  const [activeTab, setActiveTab] = useState('faculties');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{type: 'error'|'success', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);

  // Form States
  const [formData, setFormData] = useState({ name: '', code: '', faculty_id: '', subject_codes: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      if (activeTab === 'faculties') {
        const res = await api.get('/distribution/faculties');
        setFaculties(res.data);
      } else if (activeTab === 'careers') {
        const res = await api.get('/distribution/careers');
        setCareers(res.data);
        if (faculties.length === 0) {
          const fRes = await api.get('/distribution/faculties');
          setFaculties(fRes.data);
        }
      } else if (activeTab === 'departments') {
        const res = await api.get('/distribution/departments');
        setDepartments(res.data);
        if (faculties.length === 0) {
          const fRes = await api.get('/distribution/faculties');
          setFaculties(fRes.data);
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'No se pudieron cargar los datos.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Por favor seleccione un archivo CSV válido' });
      return;
    }

    const formDataFile = new FormData();
    formDataFile.append('file', file);

    setIsUploading(true);
    setMessage(null);
    try {
      const response = await api.post('/distribution/bulk-import', formDataFile, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({
        type: 'success',
        text: `Importación exitosa. Facultades: ${response.data.faculties_created}, Carreras: ${response.data.careers_created}, Departamentos: ${response.data.departments_created}`
      });
      fetchData(); // Recargar datos
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Ocurrió un error inesperado al subir el archivo.'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openEditModal = (type: 'faculty'|'career'|'department', item: any) => {
    setEditingId(item.id);
    if (type === 'faculty') {
      setFormData({ name: item.name, code: item.code, faculty_id: '', subject_codes: '' });
      setIsFacultyModalOpen(true);
    } else if (type === 'career') {
      setFormData({ name: item.name, code: item.code, faculty_id: item.faculty_id?.toString() || '', subject_codes: '' });
      setIsCareerModalOpen(true);
    } else if (type === 'department') {
      setFormData({ name: item.name, code: item.code, faculty_id: item.faculty_id?.toString() || '', subject_codes: item.subject_codes || '' });
      setIsDepartmentModalOpen(true);
    }
  };

  const handleCreate = async (type: 'faculty' | 'career' | 'department') => {
    try {
      const isEdit = editingId !== null;
      if (type === 'faculty') {
        const payload = { name: formData.name, code: formData.code, is_active: true };
        if (isEdit) await api.put(`/distribution/faculties/${editingId}`, payload);
        else await api.post('/distribution/faculties', payload);
        setIsFacultyModalOpen(false);
      } else if (type === 'career') {
        const payload = { name: formData.name, code: formData.code, faculty_id: Number(formData.faculty_id), is_active: true };
        if (isEdit) await api.put(`/distribution/careers/${editingId}`, payload);
        else await api.post('/distribution/careers', payload);
        setIsCareerModalOpen(false);
      } else if (type === 'department') {
        const payload = { name: formData.name, code: formData.code, faculty_id: Number(formData.faculty_id), subject_codes: formData.subject_codes, is_active: true };
        if (isEdit) await api.put(`/distribution/departments/${editingId}`, payload);
        else await api.post('/distribution/departments', payload);
        setIsDepartmentModalOpen(false);
      }
      setFormData({ name: '', code: '', faculty_id: '', subject_codes: '' });
      setEditingId(null);
      setMessage({ type: 'success', text: `Registro ${isEdit ? 'actualizado' : 'creado'} correctamente.` });
      fetchData();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al guardar el registro.' });
    }
  };

  const handleDelete = async (type: 'department', id: number) => {
    if (!confirm('¿Está seguro que desea eliminar este departamento? Esta acción no se puede deshacer.')) return;
    
    try {
      await api.delete(`/distribution/departments/${id}`);
      setMessage({ type: 'success', text: 'Departamento eliminado correctamente.' });
      fetchData();
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al eliminar el registro.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md border ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message.text}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            Distribución Académica
          </CardTitle>
          <CardDescription>
            Administre la estructura de Facultades, Carreras y Departamentos de la institución.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="faculties" className="flex items-center gap-2"><Building size={16}/> Facultades</TabsTrigger>
              <TabsTrigger value="careers" className="flex items-center gap-2"><BookOpen size={16}/> Carreras</TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center gap-2"><Layers size={16}/> Departamentos</TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2 text-primary font-medium"><UploadCloud size={16}/> Importación CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="faculties" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Lista de Facultades</h3>
                <Dialog open={isFacultyModalOpen} onOpenChange={setIsFacultyModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setFormData({ name: '', code: '', faculty_id: '', subject_codes: '' }); setEditingId(null); }} className="flex items-center gap-2">
                      <Plus size={16} /> Nueva Facultad
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingId ? 'Editar Facultad' : 'Nueva Facultad'}</DialogTitle>
                      <DialogDescription>
                        {editingId ? 'Modifique los datos de la facultad.' : 'Cree una nueva facultad ingresando sus datos principales.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nombre de la Facultad</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Facultad de Ingeniería" />
                      </div>
                      <div className="space-y-2">
                        <Label>Código</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Ej. FAC-ING" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsFacultyModalOpen(false)}>Cancelar</Button>
                      <Button onClick={() => handleCreate('faculty')} disabled={!formData.name || !formData.code}>Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[100px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : faculties.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay facultades registradas.</TableCell></TableRow>
                    ) : (
                      faculties.map((fac) => (
                         <TableRow key={fac.id}>
                          <TableCell className="font-medium">{fac.code}</TableCell>
                          <TableCell>{fac.name}</TableCell>
                          <TableCell>{fac.is_active ? 'Activa' : 'Inactiva'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal('faculty', fac)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="careers" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Lista de Carreras</h3>
                <Dialog open={isCareerModalOpen} onOpenChange={setIsCareerModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setFormData({ name: '', code: '', faculty_id: '', subject_codes: '' }); setEditingId(null); }} className="flex items-center gap-2">
                      <Plus size={16} /> Nueva Carrera
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingId ? 'Editar Carrera' : 'Nueva Carrera'}</DialogTitle>
                      <DialogDescription>
                        {editingId ? 'Modifique los datos de la carrera.' : 'Añada una nueva carrera y asóciela a una facultad existente.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Facultad</Label>
                        <Select value={formData.faculty_id} onValueChange={v => setFormData({...formData, faculty_id: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una facultad" />
                          </SelectTrigger>
                          <SelectContent>
                            {faculties.map(f => (
                              <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre de la Carrera</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Ingeniería de Sistemas" />
                      </div>
                      <div className="space-y-2">
                        <Label>Código</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Ej. ING-SIS" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCareerModalOpen(false)}>Cancelar</Button>
                      <Button onClick={() => handleCreate('career')} disabled={!formData.name || !formData.code || !formData.faculty_id}>Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Facultad Padre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[100px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : careers.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay carreras registradas.</TableCell></TableRow>
                    ) : (
                      careers.map((car) => (
                        <TableRow key={car.id}>
                          <TableCell className="font-medium">{car.code}</TableCell>
                          <TableCell>{car.name}</TableCell>
                          <TableCell>{car.faculty_code}</TableCell>
                          <TableCell>{car.is_active ? 'Activa' : 'Inactiva'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal('career', car)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="departments" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Lista de Departamentos</h3>
                <Dialog open={isDepartmentModalOpen} onOpenChange={setIsDepartmentModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setFormData({ name: '', code: '', faculty_id: '', subject_codes: '' }); setEditingId(null); }} className="flex items-center gap-2">
                      <Plus size={16} /> Nuevo Departamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingId ? 'Editar Departamento' : 'Nuevo Departamento'}</DialogTitle>
                      <DialogDescription>
                        {editingId ? 'Modifique los datos del departamento.' : 'Añada un nuevo departamento y asócielo a una facultad existente.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Facultad</Label>
                        <Select value={formData.faculty_id} onValueChange={v => setFormData({...formData, faculty_id: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione una facultad" />
                          </SelectTrigger>
                          <SelectContent>
                            {faculties.map(f => (
                              <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre del Departamento</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Departamento de Matemáticas" />
                      </div>
                      <div className="space-y-2">
                        <Label>Código</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Ej. DEP-MAT" />
                      </div>
                      <div className="space-y-2">
                        <Label>Códigos de Cursos Relacionados</Label>
                        <Input value={formData.subject_codes} onChange={e => setFormData({...formData, subject_codes: e.target.value})} placeholder="Ej. TAA-0493, TAA-0533" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDepartmentModalOpen(false)}>Cancelar</Button>
                      <Button onClick={() => handleCreate('department')} disabled={!formData.name || !formData.code || !formData.faculty_id}>Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Facultad Padre</TableHead>
                      <TableHead>Cursos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[100px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : departments.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay departamentos registrados.</TableCell></TableRow>
                    ) : (
                      departments.map((dep) => (
                        <TableRow key={dep.id}>
                          <TableCell className="font-medium">{dep.code}</TableCell>
                          <TableCell>{dep.name}</TableCell>
                          <TableCell>{dep.faculty_code}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={dep.subject_codes || '-'}>{dep.subject_codes || '-'}</TableCell>
                          <TableCell>{dep.is_active ? 'Activo' : 'Inactivo'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal('department', dep)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete('department', dep.id)} className="hover:text-red-600">
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-6">
              <div className="p-4 rounded-md border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Formato del archivo CSV requerido
                </div>
                <div className="text-sm">
                  Para importar masivamente la estructura de carreras y departamentos, el archivo CSV debe tener los siguientes encabezados exactos:
                  <strong> tipo, codigo, nombre, codigo_facultad_padre, codigos_cursos</strong>.
                  <br/><br/>
                  <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-md overflow-x-auto text-xs font-mono">
                    tipo,codigo,nombre,codigo_facultad_padre,codigos_cursos<br/>
                    carrera,ING-SIS,Ingeniería de Sistemas,FAC-BASE,<br/>
                    departamento,DEP-MAT,Departamento de Matemáticas,FAC-BASE,"TAA-0493, TAA-0533"
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nota: Los registros de tipo `carrera` y `departamento` requieren que la Facultad (codigo_facultad_padre) exista previamente. El campo `codigos_cursos` es opcional y solo aplica para departamentos.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">Subir archivo CSV</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                  Arrastre y suelte su archivo CSV aquí, o haga clic en el botón para seleccionarlo desde su computadora.
                </p>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Procesando...' : 'Seleccionar Archivo CSV'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
