import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, AlertTriangle, ListTree } from 'lucide-react';
import { toast } from 'sonner';

export function TaxonomySettings() {
    const queryClient = useQueryClient();
    const [strategies, setStrategies] = useState('');
    const [instruments, setInstruments] = useState('');
    const [evidences, setEvidences] = useState('');
    const [feedback, setFeedback] = useState('');
    const [rulesJson, setRulesJson] = useState('{}');
    const [jsonError, setJsonError] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['taxonomySettings'],
        queryFn: async () => {
            const res = await apiClient.get('/dashboard/settings/taxonomies');
            return res.data;
        }
    });

    useEffect(() => {
        if (data) {
            setStrategies((data.strategies || []).join('\n'));
            setInstruments((data.instruments || []).join('\n'));
            setEvidences((data.evidences || []).join('\n'));
            setFeedback((data.feedback_methods || []).join('\n'));
            setRulesJson(JSON.stringify(data.predictive_rules || {}, null, 2));
        }
    }, [data]);

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            return apiClient.post('/dashboard/settings/taxonomies', payload);
        },
        onSuccess: () => {
            toast.success("Configuración de taxonomías guardada correctamente.");
            queryClient.invalidateQueries({ queryKey: ['taxonomySettings'] });
        },
        onError: (err) => {
            toast.error("Error al guardar la configuración de taxonomías.");
            console.error(err);
        }
    });

    const handleSave = () => {
        let rules = {};
        try {
            rules = JSON.parse(rulesJson);
            setJsonError('');
        } catch (e) {
            setJsonError('El JSON de las reglas predictivas es inválido.');
            return;
        }

        const payload = {
            strategies: strategies.split('\n').map(s => s.trim()).filter(s => s),
            instruments: instruments.split('\n').map(s => s.trim()).filter(s => s),
            evidences: evidences.split('\n').map(s => s.trim()).filter(s => s),
            feedback_methods: feedback.split('\n').map(s => s.trim()).filter(s => s),
            predictive_rules: rules
        };

        mutation.mutate(payload);
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ListTree className="h-8 w-8 text-primary" />
                    Taxonomías de Evaluación
                </h2>
                <p className="text-muted-foreground mt-2">
                    Administra los catálogos base para el constructor visual. Escribe cada opción en una nueva línea.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Estrategias de Evaluación</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={strategies} 
                            onChange={e => setStrategies(e.target.value)}
                            rows={6}
                            placeholder="Ej. Foro de socialización&#10;Estudio de caso"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Instrumentos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={instruments} 
                            onChange={e => setInstruments(e.target.value)}
                            rows={6}
                            placeholder="Ej. Rúbrica de evaluación&#10;Lista de cotejo"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Evidencias</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={evidences} 
                            onChange={e => setEvidences(e.target.value)}
                            rows={6}
                            placeholder="Ej. Participación&#10;Informe del Estudio de caso"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Métodos de Retroalimentación</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={feedback} 
                            onChange={e => setFeedback(e.target.value)}
                            rows={6}
                            placeholder="Ej. Criterios de la rúbrica&#10;Análisis de resultados"
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="border-primary/20">
                <CardHeader>
                    <CardTitle className="text-primary">Reglas Predictivas (Avanzado)</CardTitle>
                    <CardDescription>
                        Configura qué sucede automáticamente cuando el usuario selecciona una Estrategia. Usa formato JSON.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {jsonError && (
                        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {jsonError}
                        </div>
                    )}
                    <Textarea 
                        value={rulesJson} 
                        onChange={e => {
                            setRulesJson(e.target.value);
                            setJsonError('');
                        }}
                        rows={12}
                        className="font-mono text-sm bg-muted/30"
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={mutation.isPending} size="lg">
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                </Button>
            </div>
        </div>
    );
}
