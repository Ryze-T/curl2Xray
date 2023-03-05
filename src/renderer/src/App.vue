<template>
  <n-card title="" style="margin-bottom: 16px">
  <n-tabs type="line" animated>
      <n-tab-pane name="scan" tab="Scan">
        <n-dynamic-input
        v-model:value="curls"
        placeholder="请输入"
        :min="1"
        :max="50"
        />
        <br>
        <n-button type="info" @click="xrayStart" :disabled="isDisabledFn">开启Xray</n-button>
  
        &nbsp;

        <n-button type="info" @click="xrayStop" :disabled="isDisabledFn">关闭Xray</n-button>

        &nbsp;
        <n-button type="info" @click="curlSubmit(curls)" :disabled="isDisabledFn">开始扫描</n-button>
        <br>
        <p id="xrayOutput" v-html="resContent" style="margin:20px 0 10px 0;white-space:pre-wrap;background:#000;color:#fff;padding:10px;height:400px;overflow:auto"></p>
        <br>
        <n-input
        v-model:value="log"
        type="textarea"
        placeholder=""
        readonly=""
        />
      </n-tab-pane>
      <n-tab-pane name="Result" tab="Result">
        <n-data-table :columns="columns" :data="data" />
      </n-tab-pane>
      <n-tab-pane name="Config" tab="Config">
        <n-form>
          <n-form-item label="Xray路径" label-placement="left">
            <n-input  placeholder="" v-model:value="xrayPath" clearable/>
          </n-form-item>
          <n-button  type="info" @click="store">保存</n-button>
        </n-form>
      </n-tab-pane>
  </n-tabs>
</n-card>
</template>


<script>
import { defineComponent, ref } from "vue";
import { NDynamicInput,NButton,NInput,NTabs,NTabPane,NDataTable,NCard,NFormItem,NForm} from 'naive-ui'


const createColumns = () => {
  return [
    {
      title: 'Addr',
      key: 'addr'
    },
    {
      title: 'Payload',
      key: 'payload'
    },
    {
      title: 'Type',
      key: 'plugin'
    },
  ]
}

export default defineComponent({
  components: {
      NDynamicInput,
      NButton,
      NInput,
      NTabs,
      NTabPane,
      NDataTable,
      NCard,
      NFormItem,
      NForm
  },
  setup(){
    return {
      curls: ref([""]),
      log: ref(""),
      resContent: ref(""),
      data: ref([]),
      columns: createColumns(),
      xrayPath: ref(""),
      isdisable: true
    }
  },
  computed:{
    isDisabledFn(){
      return !this.isdisable
    }
  },
  methods:{
    store(){
      window.xAPI.pathSet(this.xrayPath)
    },
    curlSubmit(curls){
        this.log = ""
        window.xAPI.curlScan(JSON.stringify(curls))
    },
    xrayStart(){
      if(this.xrayPath!=""){
        this.resContent = ""
        window.xAPI.xrayStart(this.xrayPath)
      }
      else{
        this.log = "请配置Xray" + "\n" + this.log
      }
    },
    xrayStop(){
       window.xAPI.xrayStop()
    } 
  },
  mounted(){
    window.xAPI.pathExist((event, value) => {
      this.isdisable = value
    })

    window.xAPI.pathGet((event, value) => {
      this.xrayPath = value
      })

    window.xAPI.logSender((event, value) => {
      this.log = value + "\n" + this.log
    })

    window.xAPI.xraySender((event, value) => {
      this.resContent = this.resContent + "\n" + value
      this.$nextTick(function(){
        var p = document.getElementById('xrayOutput');
        p.scrollTop = p.scrollHeight;
      })
    })

    window.xAPI.xrayRes((event, value) => {
      console.log(value)
      this.data.push(JSON.parse(value))
    })
  }
});
</script>

