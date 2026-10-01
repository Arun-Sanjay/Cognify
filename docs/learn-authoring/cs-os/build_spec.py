"""Build unit_spec.json for CS → OS from picks/*.json + extras.json."""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
TOPICS = [
 ("T1","t01-os-basics","OS Basics & System Calls","What an operating system does, the kinds of OS, user vs kernel mode, and how programs ask the kernel for services through system calls (including fork()).",["Types of OS","User vs kernel mode","System calls","fork()"]),
 ("T2","t02-processes","Processes","The process abstraction: states and transitions, the PCB, context switching and the schedulers that move processes between queues.",["Process states","PCB","Context switch","Schedulers","Zombie & orphan"]),
 ("T3","t03-threads","Threads","Lightweight execution units inside a process: user- vs kernel-level threads and the multithreading models.",["Thread vs process","User vs kernel threads","Multithreading models"]),
 ("T4","t04-ipc","Inter-Process Communication","How cooperating processes exchange data: shared memory, message passing and pipes.",["Shared memory","Message passing","Pipes"]),
 ("T5","t05-synchronization","Concurrency & Synchronization","Race conditions and the critical-section problem, from software solutions (Peterson) to hardware locks, semaphores, monitors and the classic problems.",["Critical section","Peterson's solution","Test-and-set","Semaphores","Producer–consumer","Readers–writers","Dining philosophers"]),
 ("T6","t06-deadlock","Deadlock","When processes wait on each other forever: the four conditions, resource-allocation graphs, prevention, avoidance (Banker's algorithm), detection and recovery.",["Necessary conditions","Resource-allocation graph","Prevention","Banker's algorithm","Detection & recovery"]),
 ("T7","t07-cpu-scheduling","CPU Scheduling","Choosing which ready process runs next: FCFS, SJF/SRTF, priority, Round Robin and multilevel queues, with Gantt-chart numericals.",["Scheduling criteria","FCFS","SJF / SRTF","Priority","Round Robin","Multilevel queues"]),
 ("T8","t08-disk-scheduling","I/O & Disk Scheduling","Disk structure and access time, and the algorithms that order disk requests: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK.",["Disk structure","Seek & rotational time","FCFS / SSTF","SCAN / C-SCAN","LOOK / C-LOOK"]),
 ("T9","t09-memory-management","Memory Management","Allocating main memory: partitions and fragmentation, paging with page tables and TLBs, multilevel paging and segmentation.",["Contiguous allocation","Fragmentation","Paging","TLB & EMAT","Multilevel paging","Segmentation"]),
 ("T10","t10-virtual-memory","Virtual Memory","Running programs larger than memory: demand paging, page faults, page-replacement algorithms, Belady's anomaly and thrashing.",["Demand paging","Page faults","FIFO / Optimal / LRU","Belady's anomaly","Thrashing"]),
 ("T11","t11-file-systems","File Systems","How files are stored on disk: directory structures, allocation methods (contiguous, linked, indexed, inode) and free-space management.",["Directory structure","Allocation methods","Inode & max file size","Free-space management"]),
]
overrides = json.load(open(f"{D}/overrides.json")) if os.path.exists(f"{D}/overrides.json") else {"remove": {}, "order": {}}
extras = json.load(open(f"{D}/extras.json")) if os.path.exists(f"{D}/extras.json") else {}
topics = []
for tid, slug, title, summary, points in TOPICS:
    lectures = []
    p = f"{D}/picks/{tid}.json"
    if os.path.exists(p):
        pick = json.load(open(p))
        for lang in ("hinglish", "english"):
            removed = set(overrides["remove"].get(tid, []))
            chosen = [{**v, "order": overrides["order"].get(v["video_id"], v.get("order", i * 10))}
                      for i, v in enumerate(pick.get(lang, [])) if v["video_id"] not in removed]
            picked = {v["video_id"] for v in chosen}
            chosen += [e for e in extras.get(tid, []) if e["language"] == lang and e["video_id"] not in picked]
            chosen.sort(key=lambda v: v.get("order", 0))
            for v in chosen:
                lectures.append({"id": v["video_id"], "language": lang, "why": v.get("why", ""),
                                 "comment_highlights": v.get("comment_highlights", []), "order": v.get("order", 0)})
    topics.append({"id": slug, "number": int(tid[1:]), "title": title, "summary": summary,
                   "syllabus_points": points, "lectures": lectures})
spec = {"subject": "cs", "unit": "os", "name": "Operating System",
        "description": "The complete GATE CS Operating System unit in 11 topics. Every topic has a hand-picked Hinglish lecture track and an English one, each with a transcript, AI study notes and a lecture tutor.",
        "syllabus": "System calls, processes, threads, inter-process communication, concurrency and synchronization. Deadlock. CPU and I/O scheduling. Memory management and virtual memory. File systems.",
        "topics": topics}
json.dump(spec, open(f"{D}/unit_spec.json", "w"), indent=1, ensure_ascii=False)
print({t["number"]: len(t["lectures"]) for t in topics})
