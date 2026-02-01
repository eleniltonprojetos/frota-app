import { useState } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { ResetPasswordForm } from './ResetPasswordForm';
import { KeyRound } from 'lucide-react';

interface ChangePasswordDialogProps {
  onUpdatePassword: (password: string) => Promise<void>;
}

export function ChangePasswordDialog({ onUpdatePassword }: ChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);

  const handleUpdate = async (password: string) => {
    await onUpdatePassword(password);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Alterar Senha">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 border-0 bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Formulário para alteração de senha
          </DialogDescription>
        </DialogHeader>
        <ResetPasswordForm onUpdatePassword={handleUpdate} />
      </DialogContent>
    </Dialog>
  );
}
