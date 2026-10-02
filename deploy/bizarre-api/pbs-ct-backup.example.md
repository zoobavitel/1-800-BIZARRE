# Example Proxmox host backup → PBS (run on pve2, not inside CT 103).
# Adjust storage id to your PBS datastore. Agent must NEVER have SSH to pve2.
#
# One-shot (Proxmox backup of CT 103):
#   pct snapshot 103 pre-change-$(date +%F)
#   # or full backup job via Datacenter → Backup, storage = your PBS
#
# Cron on pve2 (example):
#   15 4 * * * root /usr/sbin/vzdump 103 --mode snapshot --storage pbs-bizarre --compress zstd
#
# Verify:
#   pvesm list pbs-bizarre | grep 103
#   # restore to unused VMID for drill — see restore-drill.sh
#
# Note: the vzdump binary name is intentional on pve2 only.
