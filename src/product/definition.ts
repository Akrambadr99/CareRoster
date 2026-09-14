import { validateAuthorization as validate0 } from '../ward-roster/policy'
import { validateAuthorization as validate1 } from '../acuity-balance/policy'
import { validateAuthorization as validate2 } from '../credential-check/policy'
import { validateAuthorization as validate3 } from '../shift-handoff/policy'
import { validateAuthorization as validate4 } from '../agency-booking/policy'
import { validateAuthorization as validate5 } from '../isolation-cover/policy'
import { validateAuthorization as validate6 } from '../bed-status/policy'
import { validateAuthorization as validate7 } from '../escalation-policy/policy'
import type { Entity, Field, Operation, Product } from '../workspace/types'
import { entity, number, requireThat, text } from '../workspace/values'
const roles=["Staffing Coordinator","Charge Nurse","Clinical Operations Lead","Hospital Duty Manager"] as const
const textField=(key:string,label:string):Field=>({key,label,type:'text',required:true,initial:'Evidence pending'})
const numberField=(key:string,label:string,initial:number):Field=>({key,label,type:'number',required:true,integer:true,min:0,max:1000000000,initial})
const dateField=(key:string,label:string):Field=>({key,label,type:'date',required:true,initial:'2026-09-14'})
type Validator=(record:{measured:number;limit:number;evidence:string;revision:number})=>unknown
function workflowOperations(kind:string,label:string,validate:Validator):Operation[]{return[
  {key:kind+'-submit',label:'Submit '+label,kind,from:['draft'],roles:[roles[0]],run:({entity})=>{entity.status='review';return label+' submitted for independent review.'}},
  {key:kind+'-authorize',label:'Authorize '+label,kind,from:['review'],roles:[roles[1]],run:({entity})=>{validate({measured:number(entity.fields,'measured'),limit:number(entity.fields,'limit'),evidence:text(entity.fields,'evidence'),revision:entity.revision});entity.status='authorized';return label+' authorized against current evidence and limits.'}},
  {key:kind+'-execute',label:'Execute '+label,kind,from:['authorized'],roles:[roles[2]],run:({entity,now})=>{requireThat(text(entity.fields,'effectiveDate')<=now.slice(0,10),'The effective date has not arrived.');entity.status='active';return label+' executed with operational custody recorded.'}},
  {key:kind+'-block',label:'Block '+label,kind,from:['authorized','active'],roles:[roles[0],roles[2]],fields:[textField('reason','Blocking reason')],run:({entity,input})=>{requireThat(text(input,'reason').trim().length>=8,'A specific blocking reason is required.');entity.status='blocked';return label+' blocked without losing prior evidence.'}},
  {key:kind+'-recover',label:'Recover '+label,kind,from:['blocked'],roles:[roles[1]],fields:[textField('recovery','Recovery evidence')],run:({entity,input})=>{requireThat(text(input,'recovery').trim().length>=8,'Recovery evidence is required.');entity.status='review';return label+' returned to review with recovery evidence.'}},
  {key:kind+'-close',label:'Close '+label,kind,from:['active'],roles:[roles[3]],run:({entity})=>{entity.status='closed';return label+' closed by accountable authority.'}},
]}
const kinds=[{
    key:"ward-roster", label:"Ward roster coverage", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Required care hours",6), numberField('limit',"Available qualified hours",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"acuity-balance", label:"Patient acuity balance", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Assigned acuity points",4), numberField('limit',"Maximum safe acuity points",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"credential-check", label:"Clinical credential validity", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Credential score",6), numberField('limit',"Minimum credential score",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"shift-handoff", label:"Clinical shift handoff", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Completed handoff step",4), numberField('limit',"Required handoff step",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"agency-booking", label:"Agency staff booking", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Arrival minute",6), numberField('limit',"Latest safe arrival minute",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"isolation-cover", label:"Isolation-room coverage", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Available isolation nurses",4), numberField('limit',"Minimum isolation nurses",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"bed-status", label:"Bed-state synchronization", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Bed update age (minutes)",6), numberField('limit',"Maximum update age",8), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  },
{
    key:"escalation-policy", label:"Escalation policy version", states:['draft','review','authorized','active','blocked','closed'], initial:'draft', editors:[roles[0]],
    fields:[textField('owner','Accountable owner'), numberField('measured',"Roster policy revision",4), numberField('limit',"Approved policy revision",5), textField('evidence','Evidence reference'), dateField('effectiveDate','Effective date')]
  }]
const operations:Operation[]=[...workflowOperations("ward-roster", "Ward roster coverage", validate0),
...workflowOperations("acuity-balance", "Patient acuity balance", validate1),
...workflowOperations("credential-check", "Clinical credential validity", validate2),
...workflowOperations("shift-handoff", "Clinical shift handoff", validate3),
...workflowOperations("agency-booking", "Agency staff booking", validate4),
...workflowOperations("isolation-cover", "Isolation-room coverage", validate5),
...workflowOperations("bed-status", "Bed-state synchronization", validate6),
...workflowOperations("escalation-policy", "Escalation policy version", validate7)]
const seed:Entity[]=[entity("ward-roster-001","ward-roster","Ward roster coverage primary record",'review',{owner:"Staffing Coordinator",measured:4,limit:8,evidence:"EV-CAREROSTER-001",effectiveDate:'2026-09-14'}),
entity("ward-roster-002","ward-roster","Ward roster coverage recovery record",'blocked',{owner:"Clinical Operations Lead",measured:4,limit:8,evidence:"REC-CAREROSTER-001",effectiveDate:'2026-09-15'}),
entity("acuity-balance-001","acuity-balance","Patient acuity balance primary record",'review',{owner:"Staffing Coordinator",measured:4,limit:8,evidence:"EV-CAREROSTER-002",effectiveDate:'2026-09-14'}),
entity("acuity-balance-002","acuity-balance","Patient acuity balance recovery record",'blocked',{owner:"Clinical Operations Lead",measured:4,limit:8,evidence:"REC-CAREROSTER-002",effectiveDate:'2026-09-15'}),
entity("credential-check-001","credential-check","Clinical credential validity primary record",'review',{owner:"Staffing Coordinator",measured:8,limit:5,evidence:"EV-CAREROSTER-003",effectiveDate:'2026-09-14'}),
entity("credential-check-002","credential-check","Clinical credential validity recovery record",'blocked',{owner:"Clinical Operations Lead",measured:8,limit:5,evidence:"REC-CAREROSTER-003",effectiveDate:'2026-09-15'}),
entity("shift-handoff-001","shift-handoff","Clinical shift handoff primary record",'review',{owner:"Staffing Coordinator",measured:8,limit:5,evidence:"EV-CAREROSTER-004",effectiveDate:'2026-09-14'}),
entity("shift-handoff-002","shift-handoff","Clinical shift handoff recovery record",'blocked',{owner:"Clinical Operations Lead",measured:8,limit:5,evidence:"REC-CAREROSTER-004",effectiveDate:'2026-09-15'}),
entity("agency-booking-001","agency-booking","Agency staff booking primary record",'review',{owner:"Staffing Coordinator",measured:4,limit:8,evidence:"EV-CAREROSTER-005",effectiveDate:'2026-09-14'}),
entity("agency-booking-002","agency-booking","Agency staff booking recovery record",'blocked',{owner:"Clinical Operations Lead",measured:4,limit:8,evidence:"REC-CAREROSTER-005",effectiveDate:'2026-09-15'}),
entity("isolation-cover-001","isolation-cover","Isolation-room coverage primary record",'review',{owner:"Staffing Coordinator",measured:8,limit:5,evidence:"EV-CAREROSTER-006",effectiveDate:'2026-09-14'}),
entity("isolation-cover-002","isolation-cover","Isolation-room coverage recovery record",'blocked',{owner:"Clinical Operations Lead",measured:8,limit:5,evidence:"REC-CAREROSTER-006",effectiveDate:'2026-09-15'}),
entity("bed-status-001","bed-status","Bed-state synchronization primary record",'review',{owner:"Staffing Coordinator",measured:4,limit:8,evidence:"EV-CAREROSTER-007",effectiveDate:'2026-09-14'}),
entity("bed-status-002","bed-status","Bed-state synchronization recovery record",'blocked',{owner:"Clinical Operations Lead",measured:4,limit:8,evidence:"REC-CAREROSTER-007",effectiveDate:'2026-09-15'}),
entity("escalation-policy-001","escalation-policy","Escalation policy version primary record",'review',{owner:"Staffing Coordinator",measured:5,limit:5,evidence:"EV-CAREROSTER-008",effectiveDate:'2026-09-14'}),
entity("escalation-policy-002","escalation-policy","Escalation policy version recovery record",'blocked',{owner:"Clinical Operations Lead",measured:5,limit:5,evidence:"REC-CAREROSTER-008",effectiveDate:'2026-09-15'})]
export const product:Product={name:"CareRoster",description:"Hospital staffing and ward operations",accent:"#B42362",actors:roles.map((role,index)=>({id:'actor-'+String(index),name:role,role})),kinds,operations,seed,
 validate:(entities)=>{for(const row of entities){requireThat(kinds.some(kind=>kind.key===row.kind),'Unknown domain record.');requireThat(typeof row.fields['owner']==='string','Every workflow requires accountable ownership.')}},
 metrics:(entities)=>[{label:'Domain records',value:String(entities.length)},{label:'Active controls',value:String(entities.filter(row=>['review','authorized','active','blocked'].includes(row.status)).length)},{label:'Blocked',value:String(entities.filter(row=>row.status==='blocked').length)},{label:'Closed',value:String(entities.filter(row=>row.status==='closed').length)}]}
