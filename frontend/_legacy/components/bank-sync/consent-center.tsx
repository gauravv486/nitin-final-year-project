"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface ConsentInfo {
    provider: string
    bankName: string
    accountNumber: string
    purpose: string
    dataRequested: string
    consentDate: string
    expiry: string
    status: string
    consentHandle: string
}

export function ConsentCenter({ consents }: { consents: ConsentInfo[] }) {
    const { toast } = useToast()
    const [localConsents, setLocalConsents] = useState<ConsentInfo[]>(consents)

    const revokeConsent = async (consentHandle: string) => {
        try {
            // In a real app, this would call your backend API
            // await fetch(`/api/bank-sync/revoke-consent/${consentHandle}`, { method: 'POST' })
            
            setLocalConsents(prev => 
                prev.map(c => 
                    c.consentHandle === consentHandle ? { ...c, status: "REVOKED" } : c
                )
            )
            toast({
                title: "Consent Revoked",
                description: "The consent has been successfully revoked.",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to revoke consent.",
                variant: "destructive"
            })
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Account Aggregator Consent Center</CardTitle>
                <CardDescription>Manage your active data sharing consents</CardDescription>
            </CardHeader>
            <CardContent>
                {localConsents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active consents found.</p>
                ) : (
                    <div className="space-y-4">
                        {localConsents.map((consent, i) => (
                            <div key={i} className="flex flex-col gap-2 p-4 border rounded-md">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold">{consent.bankName}</h4>
                                        <p className="text-sm text-muted-foreground">Account: {consent.accountNumber}</p>
                                    </div>
                                    <Badge variant={consent.status === "ACTIVE" || consent.status === "APPROVED" ? "default" : "secondary"}>
                                        {consent.status}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                    <div><span className="font-medium">Provider:</span> {consent.provider}</div>
                                    <div><span className="font-medium">Purpose:</span> {consent.purpose}</div>
                                    <div><span className="font-medium">Data:</span> {consent.dataRequested}</div>
                                    <div><span className="font-medium">Expiry:</span> {new Date(consent.expiry).toLocaleDateString()}</div>
                                </div>
                                {consent.status !== "REVOKED" && consent.status !== "EXPIRED" && (
                                    <div className="mt-2 text-right">
                                        <Button variant="destructive" size="sm" onClick={() => revokeConsent(consent.consentHandle)}>
                                            Revoke Consent
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
