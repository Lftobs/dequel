import { useState } from 'react';
import { useCreateProject } from '../../hooks/useProjects';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { cn } from '../../lib/utils';
import { Plus } from 'lucide-react';
import * as api from '../../api/client';

import { StepBasics } from './StepBasics';
import { StepEnvironment } from './StepEnvironment';
import { StepResources } from './StepResources';
import { CreationStatusOverlay } from './CreationStatusOverlay';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const [step, setStep] = useState(1);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseDomain, setBaseDomain] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('');
  
  const [stagedEnvs, setStagedEnvs] = useState<Array<{ key: string; value: string; environment?: string }>>([]);

  const [cpuLimit, setCpuLimit] = useState('');
  const [memoryLimitMb, setMemoryLimitMb] = useState('');
  const [provisionDb, setProvisionDb] = useState(false);
  const [dbType, setDbType] = useState<'postgresql' | 'mysql'>('postgresql');
  const [dbVersion, setDbVersion] = useState('');
  const [dbCpu, setDbCpu] = useState('');
  const [dbMemory, setDbMemory] = useState('');

  const [submittingStatus, setSubmittingStatus] = useState<'idle' | 'creating_project' | 'creating_envs' | 'creating_db' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setStep(1);
      setName('');
      setDescription('');
      setBaseDomain('');
      setRepoUrl('');
      setRepoBranch('');
      setCpuLimit('');
      setMemoryLimitMb('');
      setStagedEnvs([]);
      setProvisionDb(false);
      setDbType('postgresql');
      setDbVersion('');
      setDbCpu('');
      setDbMemory('');
      setSubmittingStatus('idle');
      setErrorMessage('');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmittingStatus('creating_project');
    setErrorMessage('');
    
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        baseDomain: baseDomain.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        repoBranch: repoBranch.trim() || undefined,
        cpuLimit: cpuLimit.trim() ? Number(cpuLimit) : undefined,
        memoryLimitMb: memoryLimitMb.trim() ? Number(memoryLimitMb) : undefined,
      });

      if (stagedEnvs.length > 0) {
        setSubmittingStatus('creating_envs');
        await Promise.all(
          stagedEnvs.map(env => 
            api.createEnvVar(project.id, {
              key: env.key.trim(),
              value: env.value.trim(),
              environment: env.environment || 'production'
            })
          )
        );
      }

      if (provisionDb) {
        setSubmittingStatus('creating_db');
        await api.createDatabase(project.id, dbType, {
          version: dbVersion.trim() || undefined,
          cpuLimit: dbCpu.trim() ? Number(dbCpu) : null,
          memoryLimitMb: dbMemory.trim() ? Number(dbMemory) : null,
        });
      }

      setSubmittingStatus('done');
      
      setTimeout(() => {
        handleOpenChange(false);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred during creation.');
      setSubmittingStatus('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg shadow-amber-500/10 border-0 flex items-center gap-1.5 transition-all">
          <Plus className="h-4 w-4" />New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f12] border-[#222227] text-zinc-200 sm:max-w-3xl">
        {submittingStatus !== 'idle' ? (
          <CreationStatusOverlay
            submittingStatus={submittingStatus}
            errorMessage={errorMessage}
            hasEnvs={stagedEnvs.length > 0}
            hasDb={provisionDb}
            dbType={dbType}
            onRetry={() => setSubmittingStatus('idle')}
          />
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-zinc-100 font-bold">Create New Project</DialogTitle>
              <DialogDescription className="text-zinc-500 text-xs">
                Set up your project details, configure variables, and optionally provision a database instance.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between border-b border-[#1c1c21] pb-4 mb-6 select-none">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === 1 ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-zinc-800 text-zinc-400"
                )}>1</span>
                <span className={cn("text-xs font-medium", step === 1 ? "text-zinc-200" : "text-zinc-500")}>Basics & Git</span>
              </div>
              <div className="h-[1px] flex-1 bg-zinc-800 mx-4" />
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === 2 ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-zinc-800 text-zinc-400"
                )}>2</span>
                <span className={cn("text-xs font-medium", step === 2 ? "text-zinc-200" : "text-zinc-500")}>Environment</span>
              </div>
              <div className="h-[1px] flex-1 bg-zinc-800 mx-4" />
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === 3 ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-zinc-800 text-zinc-400"
                )}>3</span>
                <span className={cn("text-xs font-medium", step === 3 ? "text-zinc-200" : "text-zinc-500")}>Resources & DB</span>
              </div>
            </div>

            {step === 1 && (
              <StepBasics
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                baseDomain={baseDomain}
                setBaseDomain={setBaseDomain}
                repoUrl={repoUrl}
                setRepoUrl={setRepoUrl}
                repoBranch={repoBranch}
                setRepoBranch={setRepoBranch}
              />
            )}

            {step === 2 && (
              <StepEnvironment
                stagedEnvs={stagedEnvs}
                setStagedEnvs={setStagedEnvs}
              />
            )}

            {step === 3 && (
              <StepResources
                cpuLimit={cpuLimit}
                setCpuLimit={setCpuLimit}
                memoryLimitMb={memoryLimitMb}
                setMemoryLimitMb={setMemoryLimitMb}
                provisionDb={provisionDb}
                setProvisionDb={setProvisionDb}
                dbType={dbType}
                setDbType={setDbType}
                dbVersion={dbVersion}
                setDbVersion={setDbVersion}
                dbCpu={dbCpu}
                setDbCpu={setDbCpu}
                dbMemory={dbMemory}
                setDbMemory={setDbMemory}
              />
            )}

            <DialogFooter className="pt-4 border-t border-[#1a1a1f] flex justify-between items-center sm:space-x-0 select-none">
              <div className="text-zinc-500 text-[10px]">
                {step === 1 && 'Step 1 of 3: General & Git settings'}
                {step === 2 && 'Step 2 of 3: Staging env variables'}
                {step === 3 && 'Step 3 of 3: Allocation limits & Databases'}
              </div>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#222227] text-zinc-400 hover:bg-[#1a1a1f] h-9"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </Button>
                )}
                {step === 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#222227] text-zinc-400 hover:bg-[#1a1a1f] h-9"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                )}
                
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-medium h-9"
                    disabled={step === 1 && !name.trim()}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-medium h-9 px-6 shadow-lg shadow-amber-500/10 border-0"
                    disabled={!name.trim() || createProject.isPending}
                  >
                    Configure & Create
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
