import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote, Spinner } from '../components/Spinner'
import { admin, type User } from '../api'
import { errorMessage } from '../format'

function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(14))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** /t/teachers — admins create and manage teacher accounts. */
export function TeachersPage({ me }: { me: User }) {
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [busy, setBusy] = useState(false)

  const load = () => admin.teachers().then(setUsers).catch((e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [])

  if (me.role !== 'admin') return <div className="mx-auto max-w-4xl p-6"><ErrorNote message="Only admins can manage teacher accounts." /></div>
  if (error) return <div className="mx-auto max-w-4xl p-6"><ErrorNote message={error} /></div>
  if (!users) return <Spinner />

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await admin.createTeacher({ name: name.trim(), email: email.trim(), password })
      toast.success(`Account created. Send ${email.trim()} their password: ${password}`, { duration: 20000 })
      setName('')
      setEmail('')
      setPassword(generatePassword())
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const update = async (u: User, body: { is_active?: boolean; password?: string }, message: string) => {
    try {
      await admin.updateTeacher(u.id, body)
      toast.success(message, { duration: body.password ? 20000 : 4000 })
      load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Teachers</h1>
      <form onSubmit={create} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-name">Name</Label>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-email">Email</Label>
          <Input id="t-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-pass">Starting password</Label>
          <Input id="t-pass" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 font-mono" />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="h-10 w-full font-semibold" disabled={busy || !name.trim() || !email.trim() || password.length < 10}>
            Add teacher
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t border-slate-200 ${u.is_active ? '' : 'text-slate-400'}`}>
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.is_active ? u.role : 'Disabled'}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me.id && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const pw = generatePassword()
                          update(u, { password: pw }, `New password for ${u.email}: ${pw}`)
                        }}
                      >
                        Reset password
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? 'Account disabled' : 'Account enabled')}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
