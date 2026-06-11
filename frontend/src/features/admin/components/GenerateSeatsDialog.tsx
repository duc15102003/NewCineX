import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'

import { useGenerateSeats } from '@/hooks/useAdmin'

import ModeTabs from './seats/ModeTabs'
import PresetPanel from './seats/PresetPanel'
import CustomPanel from './seats/CustomPanel'
import { PRESETS, type Mode, type RoomType } from './seats/data'

export interface GenerateSeatsDialogProps {
  roomId: number | null
  roomType?: RoomType
  onClose: () => void
}

/**
 * Dialog tạo sơ đồ ghế cho phòng. 2 mode:
 * - Preset: chọn 1 trong 4 layout chuẩn (2D/3D/IMAX/4DX).
 * - Custom: tự vẽ layout từng ô (sub-component ở `./seats/CustomPanel`).
 */
export default function GenerateSeatsDialog({ roomId, roomType, onClose }: GenerateSeatsDialogProps) {
  const [mode, setMode] = useState<Mode>('preset')
  const [selectedPreset, setSelectedPreset] = useState<RoomType>(roomType ?? 'TWO_D')
  const generateMut = useGenerateSeats()

  useEffect(() => {
    if (roomId != null) {
      setMode('preset')
      setSelectedPreset(roomType ?? 'TWO_D')
    }
  }, [roomId, roomType])

  const presetInfo = PRESETS.find(p => p.key === selectedPreset)!

  function handlePresetSubmit() {
    if (roomId == null) return
    generateMut.mutate({
      roomId,
      data: { totalRows: 1, totalCols: 1, applyPresetForRoomType: true, roomTypeOverride: selectedPreset },
    }, {
      onSuccess: () => {
        toast.success('Đã tạo sơ đồ ghế. Bấm "Chỉnh sửa từng ghế" để tinh chỉnh.')
        onClose()
      },
    })
  }

  return (
    <Dialog open={roomId !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="lg" className="bg-[#201b11] border-[#3f382d] text-white rounded-2xl max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tạo sơ đồ ghế</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ModeTabs mode={mode} onChange={setMode} />

          {mode === 'preset' ? (
            <PresetPanel selected={selectedPreset} onSelect={setSelectedPreset} info={presetInfo} />
          ) : (
            <CustomPanel roomId={roomId!} onClose={onClose} generateMut={generateMut} />
          )}
        </DialogBody>
        {mode === 'preset' && (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-white/10 text-gray-300 hover:bg-white/5">Hủy</Button>
            <Button onClick={handlePresetSubmit}
              disabled={generateMut.isPending}
              className="bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg">
              {generateMut.isPending ? 'Đang tạo...' : `Tạo ${presetInfo.totalSeats} ghế`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
